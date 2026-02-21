/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                surface: {
                    900: '#0a0e1a',
                    800: '#111827',
                    700: '#1e2a3a',
                    600: '#2a3a4e',
                },
                accent: {
                    blue: '#3b82f6',
                    cyan: '#06b6d4',
                    purple: '#8b5cf6',
                    orange: '#f59e0b',
                    red: '#ef4444',
                    green: '#10b981',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            }
        },
    },
    plugins: [],
}
