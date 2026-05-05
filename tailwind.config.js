/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./diagnosis.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', '"Segoe UI"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
