import { createTheme } from "@mantine/core";

export const theme = createTheme({
  fontFamily: "var(--font-body)",
  headings: { fontFamily: "var(--font-title)" },
  primaryColor: "club",
  colors: {
    club: [
      "#eef7ef",
      "#d7ead9",
      "#b0d7b5",
      "#86c38f",
      "#60b171",
      "#49a35c",
      "#3a8d4b",
      "#2c6e3a",
      "#23582f",
      "#1c4726",
    ],
    clay: [
      "#fff4ec",
      "#ffe5d6",
      "#fcc8aa",
      "#f6a676",
      "#f0894d",
      "#ec7834",
      "#d95f22",
      "#b3491a",
      "#8c3a18",
      "#6d2f15",
    ],
    dusk: [
      "#f3f4f6",
      "#e6e7eb",
      "#cdd0d8",
      "#b3b7c4",
      "#9aa0b1",
      "#828aa0",
      "#6b7388",
      "#545a6c",
      "#414552",
      "#2f323c",
    ],
  },
  radius: {
    xs: "10px",
    sm: "14px",
    md: "18px",
    lg: "24px",
    xl: "30px",
  },
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        shadow: "md",
      },
    },
  },
});
