module.exports = {
  purge: [
    "./**/*.svelte", // Look for .svelte files
    "./**/*.html", // Look for .html files
  ],
  theme: {
    extend: {},
  },
  variants: {},
  plugins: [],
  content: ["./src/**/*.{html,js,svelte,ts}"],
};
