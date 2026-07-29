/**
 * 이 프로젝트는 Tailwind v4(CSS-first 설정)를 쓰므로, 토큰의 1차 소스는
 * src/app/globals.css의 `@theme` 블록이다. 이 파일은 같은 토큰을 클래식
 * tailwind.config 형식으로도 남겨서 v3 스타일 도구(Storybook 등)나 다른 프로젝트로
 * 토큰을 옮길 때 참고할 수 있게 하기 위한 것이다. 값을 바꿀 때는 반드시
 * globals.css의 @theme도 함께 갱신해서 두 파일이 어긋나지 않게 한다.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        "page-bg": "#F8F9FA",
        surface: "#FFFFFF",
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4FC4",
        },
        ink: "#111827",
        subtle: "#6B7280",
        border: {
          DEFAULT: "#E5E7EB",
          subtle: "#EEF0F4",
        },
        success: {
          DEFAULT: "#047857",
          bg: "#ECFDF5",
        },
        danger: {
          DEFAULT: "#DC2626",
          bg: "#FEF2F2",
        },
        warning: {
          DEFAULT: "#D97706",
          bg: "#FEF3C7",
        },
      },
      borderRadius: {
        card: "1rem",
        control: "0.625rem",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};
