'use client'

import { useState, useEffect } from 'react'
import { MessageLog } from '@/types/database'
import { parseAsmMessage, generateAsmMessage, ASM_ACTION_CODES } from '@/lib/ssim'
import { getMessageLog, createMessage, applyAsmMessage } from '@/app/actions/schedule-messages'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Send, Inbox, FileText, Check, X, Loader2, AlertTriangle, Eye } from 'lucide-react'

interface AsmSsmManagerProps {
  operatorIataCode: string
}

const ACTION_LABELS: Record<string, string> = {
  NEW: 'New Flight', TIM: 'Time Change', CNL: 'Cancellation', EQT: 'Equipment Change',
  CON: 'Config Change', RIN: 'Reinstatement', RPL: 'Replace', FLT: 'Flight # Change', SKD: 'Schedule Change',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  sent: 'bg-blue-500/10 text-blue-600',
  applied: 'bg-green-500/10 text-green-600',
  rejected: 'bg-red-500/10 text-red-600',
  discarded: 'bg-muted text-muted-foreground',
}

const DIRECTION_COLORS: Record<string, string> = {
  inbound: 'bg-cyan-500/10 text-cyan-600',
  outbound: 'bg-purple-500/10 text-purple-600',
}

export function AsmSsmManager({ operatorIataCode }: AsmSsmManagerProps) {
  const [section, setSection] = useState<'send' | 'receive'>('receive')

  // Outbound state
  const [outAction, setOutAction] = useState('TIM')
  const [outFltNum, setOutFltNum] = useState('')
  const [outDate, setOutDate] = useState('')
  const [outStd, setOutStd] = useState('')
  const [outSta, setOutSta] = useState('')
  const [outAcType, setOutAcType] = useState('')
  const [outRawMessage, setOutRawMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  // Inbound state
  const [inRawMessage, setInRawMessage] = useState('')
  const [inParsed, setInParsed] = useState<ReturnType<typeof parseAsmMessage> | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  // Message log state
  const [messages, setMessages] = useState<MessageLog[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [filterDirection, setFilterDirection] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFlight, setFilterFlight] = useState('')
  const [viewMessage, setViewMessage] = useState<MessageLog | null>(null)

  // Load log
  useEffect(() => {
    loadLog()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLog() {
    setLogLoading(true)
    const data = await getMessageLog({
      direction: filterDirection || undefined,
      action_code: filterAction || undefined,
      flight_number: filterFlight || undefined,
    })
    setMessages(data)
    setLogLoading(false)
  }

  // ── Outbound: generate preview ──
  function generateOutbound() {
    const changes: Record<string, { from?: string; to: string }> = {}
    if (outAction === 'TIM') {
      if (outStd) changes['std'] = { to: outStd }
      if (outSta) changes['sta'] = { to: outSta }
    }
    if (outAction === 'EQT' && outAcType) {
      changes['aircraft_type'] = { to: outAcType }
    }
    const raw = generateAsmMessage({
      actionCode: outAction,
      airline: operatorIataCode || 'HZ',
      flightNumber: outFltNum,
      flightDate: outDate,
      changes,
    })
    setOutRawMessage(raw)
  }

  async function handleSend() {
    if (!outRawMessage || !outFltNum) return
    setSending(true)
    const res = await createMessage({
      message_type: 'ASM',
      action_code: outAction,
      direction: 'outbound',
      flight_number: outFltNum,
      flight_date: outDate || undefined,
      status: 'sent',
      summary: `${outAction}: ${outFltNum}${outDate ? ` on ${outDate}` : ''}`,
      raw_message: outRawMessage,
      changes: {},
    })
    if (res.error) setSendResult(`Error: ${res.error}`)
    else {
      setSendResult('Message logged as sent')
      loadLog()
    }
    setSending(false)
  }

  async function handleDiscard() {
    setOutRawMessage('')
    setOutFltNum('')
    setOutDate('')
    setOutStd('')
    setOutSta('')
    setOutAcType('')
    setSendResult(null)
  }

  // ── Inbound: parse ──
  function handleParseInbound() {
    if (!inRawMessage.trim()) return
    const parsed = parseAsmMessage(inRawMessage)
    setInParsed(parsed)
    setApplyResult(null)
  }

  async function handleApply() {
    if (!inParsed) return
    setApplying(true)

    // First create the message log entry
    const msgRes = await createMessage({
      message_type: inParsed.messageType,
      action_code: inParsed.actionCode,
      direction: 'inbound',
      flight_number: inParsed.flightNumber || undefined,
      flight_date: inParsed.flightDate || undefined,
      status: 'applied',
      summary: `${inParsed.actionCode}: ${inParsed.flightNumber}${inParsed.flightDate ? ` on ${inParsed.flightDate}` : ''}`,
      raw_message: inParsed.rawMessage,
      changes: inParsed.changes as Record<string, unknown>,
    })

    if (msgRes.error) {
      setApplyResult(`Error logging message: ${msgRes.error}`)
    } else if (msgRes.id) {
      // Apply the change
      const applyRes = await applyAsmMessage({
        message_id: msgRes.id,
        action_code: inParsed.actionCode,
        flight_number: inParsed.flightNumber,
        flight_date: inParsed.flightDate || undefined,
        changes: inParsed.changes,
      })
      if (applyRes.error) setApplyResult(`Applied with warning: ${applyRes.error}`)
      else setApplyResult('Message applied successfully')
      loadLog()
    }
    setApplying(false)
  }

  async function handleReject() {
    if (!inParsed || !rejectReason) return
    await createMessage({
      message_type: inParsed.messageType,
      action_code: inParsed.actionCode,
      direction: 'inbound',
      flight_number: inParsed.flightNumber || undefined,
      flight_date: inParsed.flightDate || undefined,
      status: 'rejected',
      summary: `REJECTED: ${inParsed.actionCode}: ${inParsed.flightNumber}`,
      raw_message: inParsed.rawMessage,
      changes: { reject_reason: rejectReason } as Record<string, unknown>,
    })
    setApplyResult(`Message rejected: ${rejectReason}`)
    setShowReject(false)
    setRejectReason('')
    loadLog()
  }

  return (
    <div className="space-y-6">
      {/* Section toggle */}
      <div className="flex gap-2">
        <button onClick={() => setSection('receive')}
          className={cn('flex items-center gap-2 px-4 py-2 text-sm rounded-md border transition-colors',
            section === 'receive' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted')}>
          <Inbox className="w-4 h-4" /> Receive (Inbound)
        </button>
        <button onClick={() => setSection('send')}
          className={cn('flex items-center gap-2 px-4 py-2 text-sm rounded-md border transition-colors',
            section === 'send' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted')}>
          <Send className="w-4 h-4" /> Send (Outbound)
        </button>
      </div>

      {/* ═══════ RECEIVE ═══════ */}
      {section === 'receive' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Paste incoming ASM/SSM message</label>
            <textarea
              value={inRawMessage}
              onChange={e => setInRawMessage(e.target.value)}
              placeholder={'ASM\nTIM\nHZ100/15MAR25\n- 0600\n+ 0630'}
              className="w-full h-[140px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" className="mt-2" onClick={handleParseInbound} disabled={!inRawMessage.trim()}>
              Parse Message
            </Button>
          </div>

          {inParsed && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">
                {inParsed.messageType} {inParsed.actionCode}:{' '}
                <span className="font-mono">{inParsed.flightNumber}</span>
                {inParsed.flightDate && <span className="text-muted-foreground"> on {inParsed.flightDate}</span>}
              </div>

              {inParsed.errors.length > 0 && (
                <div className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {inParsed.errors.join('; ')}
                </div>
              )}

              {Object.keys(inParsed.changes).length > 0 && (
                <div className="text-xs space-y-1">
                  <div className="font-medium text-muted-foreground">Changes:</div>
                  {Object.entries(inParsed.changes).map(([key, val]) => (
                    <div key={key} className="font-mono">
                      {key}: {val.from && <span className="text-red-500 line-through">{val.from}</span>}
                      {val.from && ' → '}
                      <span className="text-green-600">{val.to}</span>
                    </div>
                  ))}
                </div>
              )}

              {applyResult && (
                <div className={cn('text-xs px-2 py-1 rounded',
                  applyResult.startsWith('Error') ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600')}>
                  {applyResult}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" onClick={handleApply} disabled={applying || !!applyResult}>
                  {applying ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                  Apply
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowReject(true)} disabled={!!applyResult}>
                  <X className="w-3 h-3 mr-1" /> Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ SEND ═══════ */}
      {section === 'send' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Action Code</label>
              <select value={outAction} onChange={e => setOutAction(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {ASM_ACTION_CODES.map(c => <option key={c} value={c}>{c} &mdash; {ACTION_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Flight Number</label>
              <input value={outFltNum} onChange={e => setOutFltNum(e.target.value.toUpperCase())}
                placeholder={`${operatorIataCode || 'HZ'}100`}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Flight Date</label>
              <input type="date" value={outDate} onChange={e => setOutDate(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
            </div>
            {outAction === 'TIM' && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">New STD</label>
                  <input value={outStd} onChange={e => setOutStd(e.target.value)}
                    placeholder="0630" maxLength={4}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-mono" />
                </div>
              </>
            )}
            {outAction === 'EQT' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">New A/C Type</label>
                <input value={outAcType} onChange={e => setOutAcType(e.target.value.toUpperCase())}
                  placeholder="738" maxLength={3}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-mono" />
              </div>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={generateOutbound} disabled={!outFltNum}>
            <FileText className="w-4 h-4 mr-2" /> Generate Message
          </Button>

          {outRawMessage && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground block">Raw Message (editable)</label>
              <textarea value={outRawMessage} onChange={e => setOutRawMessage(e.target.value)}
                className="w-full h-[120px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring" />

              {sendResult && (
                <div className={cn('text-xs px-2 py-1 rounded',
                  sendResult.startsWith('Error') ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600')}>
                  {sendResult}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" onClick={handleSend} disabled={sending}>
                  {sending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                  Send
                </Button>
                <Button size="sm" variant="outline" onClick={handleDiscard}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ MESSAGE LOG ═══════ */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Message Log</h3>
          <Button size="sm" variant="ghost" onClick={loadLog} disabled={logLoading}>
            {logLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={filterDirection} onChange={e => { setFilterDirection(e.target.value); }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">All Actions</option>
            {ASM_ACTION_CODES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={filterFlight} onChange={e => setFilterFlight(e.target.value)}
            placeholder="Flight #..."
            className="h-8 rounded-md border border-input bg-background px-2 text-xs w-28 font-mono" />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={loadLog}>Filter</Button>
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No messages found</div>
        ) : (
          <div className="border rounded-lg overflow-auto max-h-[350px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                <tr className="border-b">
                  <th className="px-2 py-1.5 text-left font-medium">Timestamp</th>
                  <th className="px-2 py-1.5 text-left font-medium">Dir</th>
                  <th className="px-2 py-1.5 text-left font-medium">Type</th>
                  <th className="px-2 py-1.5 text-left font-medium">Action</th>
                  <th className="px-2 py-1.5 text-left font-medium">Flight</th>
                  <th className="px-2 py-1.5 text-left font-medium">Status</th>
                  <th className="px-2 py-1.5 text-left font-medium">Details</th>
                  <th className="px-2 py-1.5 text-left font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {messages.map(msg => (
                  <tr key={msg.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setViewMessage(msg)}>
                    <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                      {new Date(msg.created_at).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-1">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', DIRECTION_COLORS[msg.direction] || '')}>
                        {msg.direction === 'inbound' ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className="px-2 py-1 font-mono">{msg.message_type}</td>
                    <td className="px-2 py-1 font-mono font-medium">{msg.action_code}</td>
                    <td className="px-2 py-1 font-mono">{msg.flight_number || '—'}</td>
                    <td className="px-2 py-1">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_COLORS[msg.status] || '')}>
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-muted-foreground truncate max-w-[200px]">{msg.summary || '—'}</td>
                    <td className="px-2 py-1">
                      <Eye className="w-3 h-3 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View message modal */}
      <Dialog open={!!viewMessage} onOpenChange={() => setViewMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {viewMessage?.message_type} {viewMessage?.action_code} — {viewMessage?.flight_number}
            </DialogTitle>
            <DialogDescription>
              {viewMessage?.direction === 'inbound' ? 'Inbound' : 'Outbound'} &bull;{' '}
              {viewMessage?.created_at && new Date(viewMessage.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 text-xs">
              <span className={cn('px-1.5 py-0.5 rounded font-medium', STATUS_COLORS[viewMessage?.status || ''])}>
                {viewMessage?.status}
              </span>
              {viewMessage?.reject_reason && (
                <span className="text-red-600">Reason: {viewMessage.reject_reason}</span>
              )}
            </div>
            {viewMessage?.summary && (
              <p className="text-sm text-muted-foreground">{viewMessage.summary}</p>
            )}
            {viewMessage?.raw_message && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Raw Message</div>
                <pre className="text-[11px] font-mono bg-muted/30 border rounded p-3 whitespace-pre-wrap overflow-auto max-h-[200px]">
                  {viewMessage.raw_message}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Message</DialogTitle>
            <DialogDescription>Provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason..."
            className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
