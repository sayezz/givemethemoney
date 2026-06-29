import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Box, TextField, Button, Typography, MenuItem, Select, InputLabel,
  FormControl, Alert, CircularProgress, Divider, Paper, List, ListItemButton,
  ListItemText,
} from '@mui/material';
import type { StockSearchResult, Broker } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const fmt = (v: number | null | undefined): string =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

const AddPositionForm: React.FC<Props> = ({ onCreated, onCancel }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [originalCurrency, setOriginalCurrency] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [fixedFee, setFixedFee] = useState('4.90');
  const [percentFee, setPercentFee] = useState('0.25');
  const [sellFeeFixed, setSellFeeFixed] = useState('4.90');
  const [sellFeePercent, setSellFeePercent] = useState('0.25');
  const [taxRate, setTaxRate] = useState('26');
  const [quoteProvider, setQuoteProvider] = useState('yahoo');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [brokerId, setBrokerId] = useState<number | ''>('');

  const applyBroker = (b: Broker) => {
    setFixedFee(String(b.buy_fee_fixed));
    setPercentFee(String(b.buy_fee_percent));
    setSellFeeFixed(String(b.sell_fee_fixed));
    setSellFeePercent(String(b.sell_fee_percent));
    setTaxRate(String(b.tax_rate));
  };

  // Load brokers and apply the default's fees up front.
  useEffect(() => {
    axios.get(`${API_URL}/brokers`).then(({ data }) => {
      const list: Broker[] = data.brokers || [];
      setBrokers(list);
      const def = list.find((b) => b.is_default) || list[0];
      if (def) { setBrokerId(def.id); applyBroker(def); }
    }).catch(() => {});
  }, []);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2 || (selectedStock && query === `${selectedStock.symbol} - ${selectedStock.name}`)) {
      setSearchResults([]); setShowResults(false); setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_URL}/stocks/search`, { params: { q: query } });
        setSearchResults(data.results || []);
        setShowResults(true);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedStock]);

  const selectStock = async (stock: StockSearchResult) => {
    setSelectedStock(stock);
    setQuery(`${stock.symbol} - ${stock.name}`);
    setShowResults(false); setSearchResults([]); setError('');
    setOriginalPrice(null); setOriginalCurrency(null);
    setPriceLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/stocks/quote`, { params: { symbol: stock.symbol, provider: quoteProvider } });
      const quote = data.quote;
      if (quote?.price != null) {
        const curr: string = quote.currency || 'EUR';
        let adjPrice: number = quote.price;
        let adjCurr: string = curr;
        if (curr === 'GBp' || curr === 'GBX') { adjPrice = quote.price / 100; adjCurr = 'GBP'; }
        setOriginalCurrency(curr); setOriginalPrice(adjPrice);
        if (adjCurr === 'EUR') {
          setPrice(String(adjPrice));
        } else {
          try {
            const rateResp = await axios.get(`${API_URL}/stocks/quote`, { params: { symbol: `EUR${adjCurr}=X` } });
            const rate: number = rateResp.data.quote?.price;
            setPrice(rate > 0 ? (adjPrice / rate).toFixed(4) : String(adjPrice));
          } catch { setPrice(String(adjPrice)); }
        }
      }
    } catch { /* live price failed — user enters manually */ }
    finally { setPriceLoading(false); }
  };

  const quantityNum = Number.parseFloat(quantity) || 0;
  const priceNum = Number.parseFloat(price) || 0;
  const fixedFeeNum = Number.parseFloat(fixedFee) || 0;
  const percentFeeNum = Number.parseFloat(percentFee) || 0;
  const sellFeeFixedNum = Number.parseFloat(sellFeeFixed) || 0;
  const sellFeePercentNum = Number.parseFloat(sellFeePercent) || 0;
  const taxRateNum = Number.parseFloat(taxRate) || 0;

  const purchaseCost = quantityNum * priceNum;
  const purchaseFee = fixedFeeNum + (percentFeeNum / 100) * purchaseCost;
  const sellFee = sellFeeFixedNum + (sellFeePercentNum / 100) * purchaseCost;
  const totalCost = purchaseCost + purchaseFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedStock) { setError('Bitte zuerst eine Aktie suchen und auswählen.'); return; }
    if (quantityNum <= 0) { setError('Die Menge muss größer als 0 sein.'); return; }
    if (priceNum <= 0) { setError('Der Preis pro Aktie muss größer als 0 sein.'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/positions`, {
        name: selectedStock.name, ticker: selectedStock.symbol,
        quantity: quantityNum, purchase_cost: purchaseCost,
        purchase_fee: purchaseFee, purchase_fee_fixed: fixedFeeNum, purchase_fee_percent: percentFeeNum,
        sell_fee: sellFee, sell_fee_fixed: sellFeeFixedNum, sell_fee_percent: sellFeePercentNum,
        tax_rate: taxRateNum, quote_provider: quoteProvider,
        purchase_date: purchaseDate || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Investment konnte nicht hinzugefügt werden.');
    } finally { setSubmitting(false); }
  };

  const numField = (label: string, value: string, onChange: (v: string) => void, props?: object) => (
    <TextField label={label} type="number" value={value} onChange={(e) => onChange(e.target.value)}
      inputProps={{ min: 0, step: 'any' }} size="small" fullWidth {...props} />
  );

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" mb={2}>Investment hinzufügen</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Top row: stock search, purchase date, quote provider */}
      <Box display="grid" gridTemplateColumns="2fr 1fr 1fr" gap={2} mb={2} alignItems="flex-start">
        <Box position="relative">
          <TextField
            label="Aktie suchen (Name, Symbol, ISIN, WKN)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedStock(null); }}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            fullWidth size="small" autoComplete="off"
            InputProps={{ endAdornment: searching ? <CircularProgress size={16} /> : null }}
          />
          {showResults && searchResults.length > 0 && (
            <Paper sx={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 240, overflow: 'auto' }}>
              <List dense disablePadding>
                {searchResults.map((s) => (
                  <ListItemButton key={s.symbol} onClick={() => selectStock(s)}>
                    <ListItemText
                      primary={<><strong>{s.symbol}</strong> — {s.name}</>}
                      secondary={s.exchange}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          )}
          {showResults && !searching && searchResults.length === 0 && (
            <Typography variant="caption" color="text.secondary">Keine Treffer gefunden.</Typography>
          )}
        </Box>

        <TextField
          label="Kaufdatum"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: new Date().toISOString().slice(0, 10) }}
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Kursanbieter</InputLabel>
          <Select value={quoteProvider} label="Kursanbieter" onChange={(e) => setQuoteProvider(e.target.value)}>
            <MenuItem value="yahoo">Yahoo Finance</MenuItem>
            <MenuItem value="fmp">Financial Modeling Prep (FMP)</MenuItem>
            <MenuItem value="alphavantage">Alpha Vantage (25 req/Tag)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Quantity & Price */}
      <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mb={2}>
        {numField('Menge der Aktien', quantity, setQuantity, { required: true })}
        <Box>
          {numField(priceLoading ? 'Preis (lädt…)' : 'Preis der Aktie (€)', price, setPrice, { required: true })}
          {selectedStock && !priceLoading && (
            <Typography variant="caption" color="text.secondary">
              {originalCurrency && originalCurrency !== 'EUR' && originalPrice != null
                ? `Originalkurs: ${fmt(originalPrice)} ${originalCurrency} → umgerechnet`
                : 'Automatisch befüllt — bei Bedarf anpassen.'}
            </Typography>
          )}
        </Box>
      </Box>

      {brokers.length > 0 && (
        <FormControl size="small" sx={{ mb: 1, minWidth: 240 }}>
          <InputLabel>Broker (Gebührenvorlage)</InputLabel>
          <Select
            label="Broker (Gebührenvorlage)"
            value={brokerId}
            onChange={(e) => {
              const id = e.target.value as number;
              setBrokerId(id);
              const b = brokers.find((x) => x.id === id);
              if (b) applyBroker(b);
            }}
          >
            {brokers.map((b) => (
              <MenuItem key={b.id} value={b.id}>{b.name}{b.is_default ? ' ★' : ''}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 2, mb: 1 }}>Kaufgebühren</Typography>
      <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mb={2}>
        {numField('Ordergebühr fix (€)', fixedFee, setFixedFee)}
        {numField('Ordergebühr (%)', percentFee, setPercentFee)}
      </Box>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 2, mb: 1 }}>Verkaufsgebühren & Steuern</Typography>
      <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={2} mb={2}>
        {numField('Ordergebühr fix (€)', sellFeeFixed, setSellFeeFixed)}
        {numField('Ordergebühr (%)', sellFeePercent, setSellFeePercent)}
        {numField('Abgeltungssteuer (%)', taxRate, setTaxRate)}
      </Box>


      {/* Summary */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box display="grid" gridTemplateColumns="1fr auto" rowGap={0.5}>
          <Typography variant="body2">Kaufpreis (Menge × Preis)</Typography>
          <Typography variant="body2" textAlign="right">{fmt(purchaseCost)} €</Typography>
          <Typography variant="body2">Kaufgebühren gesamt</Typography>
          <Typography variant="body2" textAlign="right">{fmt(purchaseFee)} €</Typography>
          <Typography variant="body2">Verkaufsgebühren (Schätzung)</Typography>
          <Typography variant="body2" textAlign="right">{fmt(sellFee)} €</Typography>
          <Divider sx={{ gridColumn: '1 / -1', my: 0.5 }} />
          <Typography variant="body1" fontWeight={700}>Gesamtkaufpreis</Typography>
          <Typography variant="body1" fontWeight={700} textAlign="right">{fmt(totalCost)} €</Typography>
        </Box>
      </Paper>

      <Box display="flex" gap={2} justifyContent="flex-end">
        <Button variant="outlined" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? <CircularProgress size={20} color="inherit" /> : 'Investment hinzufügen'}
        </Button>
      </Box>
    </Box>
  );
};

export default AddPositionForm;
