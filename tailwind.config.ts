import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  			mono: ['var(--font-mono)', '"SF Mono"', 'Monaco', 'monospace'],
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				foreground: 'hsl(var(--info-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			xl: '16px',
  			'2xl': '20px',
  			'3xl': '24px',
  		},
  		backdropBlur: {
  			xs: '2px',
  			xl: '20px',
  			'2xl': '30px',
  			'3xl': '40px',
  		},
  		boxShadow: {
  			'glass': '0 1px 3px rgba(0, 0, 0, 0.04)',
  			'glass-lg': '0 4px 12px rgba(0, 0, 0, 0.06)',
  			'glass-glow': '0 0 20px rgba(107, 157, 173, 0.15), 0 4px 12px rgba(0, 0, 0, 0.04)',
  		},
  		keyframes: {
  			'fade-in': {
  				from: { opacity: '0' },
  				to: { opacity: '1' },
  			},
  			'fade-up': {
  				from: { opacity: '0', transform: 'translateY(12px)' },
  				to: { opacity: '1', transform: 'translateY(0)' },
  			},
  			'scale-up': {
  				from: { opacity: '0', transform: 'scale(0.95)' },
  				to: { opacity: '1', transform: 'scale(1)' },
  			},
  			'zoom-in': {
  				from: { opacity: '0', transform: 'scale(0.92)' },
  				to: { opacity: '1', transform: 'scale(1)' },
  			},
  			'zoom-out': {
  				from: { opacity: '0', transform: 'scale(1.06)' },
  				to: { opacity: '1', transform: 'scale(1)' },
  			},
  		},
  		animation: {
  			'fade-in': 'fade-in 0.3s ease-out',
  			'fade-up': 'fade-up 0.4s ease-out',
  			'scale-up': 'scale-up 0.3s ease-out',
  			'zoom-in': 'zoom-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards',
  			'zoom-out': 'zoom-out 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
