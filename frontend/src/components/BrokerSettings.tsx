import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Table,
  TableHead, TableBody, TableRow, TableCell, TextField, Button, Checkbox,
  Tooltip, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import type { Broker } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const emptyForm = {
  name: '', buy_fee_fixed: '', buy_fee_percent: '',
  sell_fee_fixed: '', sell_fee_percent: '', tax_rate: '26.375', is_default: false,
};

interface Props { onClose: () => void; onChanged?: () => void; }

const BrokerSettings: React.FC<Props> = ({ onClose, onChanged }) => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/brokers`);
      setBrokers(data.brokers || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const num = (s: string) => Number.parseFloat(s) || 0;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await axios.post(`${API_URL}/brokers`, {
      name: form.name.trim(),
      buy_fee_fixed: num(form.buy_fee_fixed), buy_fee_percent: num(form.buy_fee_percent),
      sell_fee_fixed: num(form.sell_fee_fixed), sell_fee_percent: num(form.sell_fee_percent),
      tax_rate: num(form.tax_rate), is_default: form.is_default,
    });
    setForm({ ...emptyForm });
    await load(); onChanged?.();
  };

  const saveRow = async (b: Broker) => {
    await axios.put(`${API_URL}/brokers/${b.id}`, b);
    await load(); onChanged?.();
  };

  const setDefault = async (b: Broker) => {
    await axios.put(`${API_URL}/brokers/${b.id}`, { ...b, is_default: true });
    await load(); onChanged?.();
  };

  const del = async (id: number) => {
    await axios.delete(`${API_URL}/brokers/${id}`);
    await load(); onChanged?.();
  };

  const patch = (id: number, field: keyof Broker, value: number | string) =>
    setBrokers((bs) => bs.map((b) => (b.id === id ? { ...b, [field]: value } : b)));

  const numCell = (b: Broker, field: keyof Broker) => (
    <TextField
      type="number" size="small" variant="standard"
      value={(b[field] as number) ?? 0}
      onChange={(e) => patch(b.id, field, Number.parseFloat(e.target.value) || 0)}
      onBlur={() => saveRow(b)}
      inputProps={{ step: 'any', min: 0, style: { width: 64, textAlign: 'right' } }}
    />
  );

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Broker & Standard-Gebühren
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Standard</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Kauf fix €</TableCell>
                <TableCell align="right">Kauf %</TableCell>
                <TableCell align="right">Verkauf fix €</TableCell>
                <TableCell align="right">Verkauf %</TableCell>
                <TableCell align="right">Steuer %</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {brokers.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Tooltip title={b.is_default ? 'Standard' : 'Als Standard setzen'}>
                      <IconButton size="small" color={b.is_default ? 'warning' : 'default'} onClick={() => setDefault(b)}>
                        {b.is_default ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <TextField variant="standard" size="small" value={b.name}
                      onChange={(e) => patch(b.id, 'name', e.target.value)} onBlur={() => saveRow(b)} />
                  </TableCell>
                  <TableCell align="right">{numCell(b, 'buy_fee_fixed')}</TableCell>
                  <TableCell align="right">{numCell(b, 'buy_fee_percent')}</TableCell>
                  <TableCell align="right">{numCell(b, 'sell_fee_fixed')}</TableCell>
                  <TableCell align="right">{numCell(b, 'sell_fee_percent')}</TableCell>
                  <TableCell align="right">{numCell(b, 'tax_rate')}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => del(b.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {brokers.length === 0 && (
                <TableRow><TableCell colSpan={8}><Typography variant="caption" color="text.secondary">Keine Broker angelegt.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}

        <Box component="form" onSubmit={add} display="flex" flexWrap="wrap" gap={1.5} alignItems="center" mt={2}>
          <TextField size="small" label="Neuer Broker" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ minWidth: 160 }} />
          <TextField size="small" type="number" label="Kauf fix €" value={form.buy_fee_fixed} onChange={(e) => setForm({ ...form, buy_fee_fixed: e.target.value })} inputProps={{ step: 'any' }} sx={{ width: 110 }} />
          <TextField size="small" type="number" label="Kauf %" value={form.buy_fee_percent} onChange={(e) => setForm({ ...form, buy_fee_percent: e.target.value })} inputProps={{ step: 'any' }} sx={{ width: 90 }} />
          <TextField size="small" type="number" label="Verkauf fix €" value={form.sell_fee_fixed} onChange={(e) => setForm({ ...form, sell_fee_fixed: e.target.value })} inputProps={{ step: 'any' }} sx={{ width: 110 }} />
          <TextField size="small" type="number" label="Verkauf %" value={form.sell_fee_percent} onChange={(e) => setForm({ ...form, sell_fee_percent: e.target.value })} inputProps={{ step: 'any' }} sx={{ width: 90 }} />
          <TextField size="small" type="number" label="Steuer %" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} inputProps={{ step: 'any' }} sx={{ width: 90 }} />
          <Box display="flex" alignItems="center"><Checkbox checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /><Typography variant="caption">Standard</Typography></Box>
          <Button type="submit" variant="contained" size="small">Hinzufügen</Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Voreingestellte Gebühren sind Näherungswerte – bitte an die eigenen Konditionen anpassen.
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

export default BrokerSettings;
