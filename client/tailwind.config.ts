import type { Config } from "tailwindcss";

export default {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                // Primary palette - Premium Indigo/Violet (Academic/Royal)
                primary: {
                    50: "#e0e7ff",
                    100: "#c7d2fe",
                    200: "#a5b4fc",
                    300: "#818cf8",
                    400: "#6366f1", // Main Brand Color
                    500: "#4f46e5",
                    600: "#4338ca",
                    700: "#3730a3",
                    800: "#312e81",
                    900: "#1e1b4b",
                    950: "#0f0e28", // Deepest background
                },
                // Secondary palette - Teal/Emerald (Success/Growth)
                secondary: {
                    50: "#f0fdfa",
                    100: "#ccfbf1",
                    200: "#99f6e4",
                    300: "#5eead4",
                    400: "#2dd4bf",
                    500: "#14b8a6",
                    600: "#0d9488",
                    700: "#0f766e",
                    800: "#115e59",
                    900: "#134e4a",
                    950: "#042f2e",
                },
                // Accent palette - Vibrant Purple/Pink (Highlights)
                accent: {
                    50: "#fdf4ff",
                    100: "#fae8ff",
                    200: "#f5d0fe",
                    300: "#f0abfc",
                    400: "#e879f9",
                    500: "#d946ef",
                    600: "#c026d3",
                    700: "#a21caf",
                    800: "#86198f",
                    900: "#701a75",
                    950: "#4a044e",
                },
                // Neutral palette - Cool Slate (Professional)
                neutral: {
                    50: "#f8fafc",
                    100: "#f1f5f9",
                    200: "#e2e8f0",
                    300: "#cbd5e1",
                    400: "#94a3b8",
                    500: "#64748b",
                    600: "#475569",
                    700: "#334155",
                    800: "#1e293b",
                    900: "#0f172a",
                    950: "#020617",
                },
                // Semantic
                success: "#10b981",
                warning: "#f59e0b",
                error: "#ef4444",
                info: "#3b82f6",
                surface: {
                    light: "#ffffff",
                    dark: "#0f172a",
                }
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                display: ["Outfit", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            fontSize: {
                "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
            },
            boxShadow: {
                "soft": "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
                "glow-sm": "0 0 10px rgba(99, 102, 241, 0.3)",
                "glow": "0 0 20px rgba(99, 102, 241, 0.5)",
                "glow-lg": "0 0 40px rgba(99, 102, 241, 0.4)",
                "glass": "0 4px 30px rgba(0, 0, 0, 0.1)",
            },
            backgroundImage: {
                "gradient-mesh": "radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(217, 70, 239, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(20, 184, 166, 0.15) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(99, 102, 241, 0.15) 0px, transparent 50%)",
                "gradient-dark-mesh": "radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.2) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(168, 85, 247, 0.2) 0px, transparent 50%)",
            },
            animation: {
                "fade-in": "fadeIn 0.6s ease-out forwards",
                "slide-up": "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "slide-down": "slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "scale-in": "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "float": "float 6s ease-in-out infinite",
                "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideDown: {
                    "0%": { opacity: "0", transform: "translateY(-20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                scaleIn: {
                    "0%": { opacity: "0", transform: "scale(0.9)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
            },
            backdropBlur: {
                xs: "2px",
                md: "12px",
                lg: "16px",
            },
        },
    },
    plugins: [],
} satisfies Config;
