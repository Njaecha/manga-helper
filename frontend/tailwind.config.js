/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Background colors
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          surface: 'var(--color-bg-surface)',
          canvas: 'var(--color-bg-canvas)',
          hover: 'var(--color-hover)',
          active: 'var(--color-active)',
        },
        // Text colors
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          hint: 'var(--color-text-hint)',
          heading: 'var(--color-text-heading)',
        },
        // Border colors
        border: {
          primary: 'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
          light: 'var(--color-border-light)',
        },
        // Accent colors
        accent: {
          blue: {
            DEFAULT: 'var(--color-accent-blue)',
            hover: 'var(--color-accent-blue-hover)',
            light: 'var(--color-accent-blue-light)',
            dark: 'var(--color-accent-blue-dark)',
          },
          green: {
            DEFAULT: 'var(--color-accent-green)',
            hover: 'var(--color-accent-green-hover)',
            light: 'var(--color-accent-green-light)',
            dark: 'var(--color-accent-green-dark)',
          },
          red: {
            DEFAULT: 'var(--color-accent-red)',
            hover: 'var(--color-accent-red-hover)',
            light: 'var(--color-accent-red-light)',
            dark: 'var(--color-accent-red-dark)',
          },
          amber: {
            DEFAULT: 'var(--color-accent-amber)',
            hover: 'var(--color-accent-amber-hover)',
          },
        },
        // Button colors
        button: {
          primary: 'var(--color-button-primary)',
          'primary-hover': 'var(--color-button-primary-hover)',
          secondary: 'var(--color-button-secondary)',
          'secondary-hover': 'var(--color-button-secondary-hover)',
          disabled: 'var(--color-button-disabled)',
          'text-disabled': 'var(--color-button-text-disabled)',
        },
        // Input colors
        input: {
          bg: 'var(--color-input-bg)',
          border: 'var(--color-input-border)',
          'border-focus': 'var(--color-input-border-focus)',
          text: 'var(--color-input-text)',
          placeholder: 'var(--color-input-placeholder)',
        },
        // State colors
        hover: 'var(--color-hover)',
        active: 'var(--color-active)',
        focus: 'var(--color-focus-ring)',
        // Error/Success
        error: {
          bg: 'var(--color-error-bg)',
          border: 'var(--color-error-border)',
          text: 'var(--color-error-text)',
        },
        success: {
          bg: 'var(--color-success-bg)',
          text: 'var(--color-success-text)',
        },
        // Canvas colors
        canvas: {
          bg: 'var(--color-canvas-bg)',
          empty: 'var(--color-canvas-empty)',
        },
        // Legend colors
        legend: {
          bg: 'var(--color-legend-bg)',
          text: 'var(--color-legend-text)',
        },
        // Box colors (speech bubble detection)
        box: {
          detected: 'var(--color-box-detected)',
          custom: 'var(--color-box-custom)',
          selected: 'var(--color-box-selected)',
        },
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      opacity: {
        'box-default': 'var(--opacity-box-default)',
        'box-selected': 'var(--opacity-box-selected)',
        'disabled': 'var(--opacity-disabled)',
      },
      animation: {
        'spin-slow': 'spin 0.8s linear infinite',
        'fade-in': 'fadeIn 200ms ease-in-out',
        'fade-out': 'fadeOut 200ms ease-in-out',
        'blink': 'blink 1s step-start infinite',
        'slide-up': 'slideUp 300ms ease-in-out',
        'slide-down': 'slideDown 300ms ease-in-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        blink: {
          '50%': { opacity: '0' },
        },
        slideUp: {
          from: {
            transform: 'translateY(0)',
            opacity: '1',
          },
          to: {
            transform: 'translateY(-100%)',
            opacity: '0',
          },
        },
        slideDown: {
          from: {
            transform: 'translateY(-100%)',
            opacity: '0',
          },
          to: {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
      },
    },
  },
  plugins: [],
}
