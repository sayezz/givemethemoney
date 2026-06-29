import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: '#667eea' },
      secondary: { main: '#764ba2' },
      ...(mode === 'dark' && {
        background: { default: '#0f1117', paper: '#1a1d27' },
      }),
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

export default createAppTheme('dark');
