import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#667eea' },
    secondary: { main: '#764ba2' },
    background: { default: '#0f1117', paper: '#1a1d27' },
  },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
  },
});

export default theme;

