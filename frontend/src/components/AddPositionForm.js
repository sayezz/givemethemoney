import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { currencySymbol, formatDual } from '../utils/currency';
import './AddPositionForm.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AddPositionForm = ({ onCreated, onCancel }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);
  const [quantity, setQuantity] = useState('');
  // price is always entered/displayed in the stock's native currency
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  // native currency units per 1 EUR
  const [fxRate, setFxRate] = useState(1);
  const [fxRateError, setFxRateError] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [fixedFee, setFixedFee] = useState('4.90');
  const [percentFee, setPercentFee] = useState('0.25');
  const [sellFeeFixed, setSellFeeFixed] = useState('4.90');
  const [sellFeePercent, setSellFeePercent] = useState('0.25');
  const [taxRate, setTaxRate] = useState('26');
  const [quoteProvider, setQuoteProvider] = useState('yahoo');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query || query.trim().length < 2 || (selectedStock && query === `${selectedStock.symbol} - ${selectedStock.name}`)) {
      setSearchResults([]);
      setShowResults(false);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await axios.get(`${API_URL}/stocks/search`, { params: { q: query } });
        setSearchResults(response.data.results || []);
        setShowResults(true);
      } catch (err) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query, selectedStock]);

  const selectStock = async (stock) => {
    setSelectedStock(stock);
    setQuery(`${stock.symbol} - ${stock.name}`);
    setShowResults(false);
    setSearchResults([]);
    setError('');
    setCurrency('EUR');
    setFxRate(1);
    setFxRateError(false);

    setPriceLoading(true);
    try {
      const response = await axios.get(`${API_URL}/stocks/quote`, { params: { symbol: stock.symbol, provider: quoteProvider } });
      const quote = response.data.quote;
      if (quote && quote.price != null) {
        const curr = quote.currency || 'EUR';

        // GBX/GBp = pence → convert to GBP first
        let adjPrice = quote.price;
        let adjCurr = curr;
        if (curr === 'GBp' || curr === 'GBX') {
          adjPrice = quote.price / 100;
          adjCurr = 'GBP';
        }

        setCurrency(adjCurr);
        setPrice(String(adjPrice));

        if (adjCurr === 'EUR') {
          setFxRate(1);
        } else {
          // Fetch EUR conversion rate: EUR{adjCurr}=X gives how many adjCurr per 1 EUR.
          // Note: must be sent unencoded — the backend doesn't URL-decode query
          // params, so an axios `params` object (which encodes '=' to %3D) 404s.
          try {
            const rateResp = await axios.get(`${API_URL}/stocks/quote?symbol=EUR${adjCurr}=X`);
            const rate = rateResp.data.quote?.price;
            if (rate && rate > 0) {
              setFxRate(rate);
            } else {
              setFxRate(1);
              setFxRateError(true);
            }
          } catch {
            setFxRate(1);
            setFxRateError(true);
          }
        }
      }
    } catch (err) {
      // Live price lookup failed — user can enter manually
    } finally {
      setPriceLoading(false);
    }
  };

  const quantityNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(price) || 0; // native currency
  const fixedFeeNum = parseFloat(fixedFee) || 0; // EUR
  const percentFeeNum = parseFloat(percentFee) || 0;

  const sellFeeFixedNum = parseFloat(sellFeeFixed) || 0; // EUR
  const sellFeePercentNum = parseFloat(sellFeePercent) || 0;
  const taxRateNum = parseFloat(taxRate) || 0;

  // All amounts stored in the backend are EUR ground truth — convert from
  // the native-currency price using the cached EUR/native FX rate.
  const purchaseCostNative = quantityNum * priceNum;
  const purchaseCost = currency === 'EUR' ? purchaseCostNative : purchaseCostNative / fxRate;
  const purchaseFee = fixedFeeNum + (percentFeeNum / 100) * purchaseCost;
  const sellFee = sellFeeFixedNum + (sellFeePercentNum / 100) * purchaseCost;
  const totalCost = purchaseCost + purchaseFee;

  const toNative = (eurValue) => currency === 'EUR' ? eurValue : eurValue * fxRate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedStock) {
      setError('Bitte zuerst eine Aktie suchen und auswählen.');
      return;
    }
    if (quantityNum <= 0) {
      setError('Die Menge muss größer als 0 sein.');
      return;
    }
    if (priceNum <= 0) {
      setError('Der Preis pro Aktie muss größer als 0 sein.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/positions`, {
        name: selectedStock.name,
        ticker: selectedStock.symbol,
        quantity: quantityNum,
        purchase_cost: purchaseCost,
        purchase_fee: purchaseFee,
        purchase_fee_fixed: fixedFeeNum,
        purchase_fee_percent: percentFeeNum,
        sell_fee: sellFee,
        sell_fee_fixed: sellFeeFixedNum,
        sell_fee_percent: sellFeePercentNum,
        tax_rate: taxRateNum,
        quote_provider: quoteProvider,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Investment konnte nicht hinzugefügt werden.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="add-position-form" onSubmit={handleSubmit}>
      <h3>Investment hinzufügen</h3>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group stock-search">
        <label>Aktie suchen (Name, Symbol, ISIN, WKN)</label>
        <input
          type="text"
          value={query}
          placeholder="Name, Symbol, ISIN oder WKN"
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedStock(null);
          }}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          autoComplete="off"
        />
        {searching && <div className="search-status">Suche läuft...</div>}
        {showResults && searchResults.length > 0 && (
          <ul className="search-results">
            {searchResults.map((stock) => (
              <li key={stock.symbol} onClick={() => selectStock(stock)}>
                <span className="symbol">{stock.symbol}</span>
                <span className="name">{stock.name}</span>
                {stock.exchange && <span className="exchange">{stock.exchange}</span>}
              </li>
            ))}
          </ul>
        )}
        {showResults && !searching && searchResults.length === 0 && (
          <div className="search-status">Keine Treffer gefunden.</div>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Menge der Aktien</label>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>
            Preis der Aktie ({currencySymbol(currency)}) {priceLoading && <span className="hint">(lädt aktuellen Kurs...)</span>}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={selectedStock ? '' : 'Erst Aktie auswählen oder manuell eingeben'}
            required
          />
          {selectedStock && (
            <span className="hint">
              {currency !== 'EUR'
                ? fxRateError
                  ? `Wechselkurs konnte nicht geladen werden — Preis wird als € behandelt. Bei Bedarf anpassen.`
                  : `Kurs in ${currency} (1 € ≈ ${fxRate.toFixed(4)} ${currency}) — bei Bedarf anpassen.`
                : 'Automatisch befüllt — bei Bedarf anpassen.'}
            </span>
          )}
        </div>
      </div>

      <div className="form-section-label">Kaufgebühren</div>
      <div className="form-row">
        <div className="form-group">
          <label>Ordergebühr fix (€)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={fixedFee}
            onChange={(e) => setFixedFee(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label>Ordergebühr in %</label>
          <input
            type="number"
            min="0"
            step="any"
            value={percentFee}
            onChange={(e) => setPercentFee(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="form-section-label">Verkaufsgebühren</div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <label>Ordergebühr fix (€)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={sellFeeFixed}
            onChange={(e) => setSellFeeFixed(e.target.value)}
            placeholder="4.90"
          />
        </div>
        <div className="form-group">
          <label>Ordergebühr in %</label>
          <input
            type="number"
            min="0"
            step="any"
            value={sellFeePercent}
            onChange={(e) => setSellFeePercent(e.target.value)}
            placeholder="0.25"
          />
        </div>
        <div className="form-group">
          <label>Abgeltungssteuer in %</label>
          <input
            type="number"
            min="0"
            step="any"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            placeholder="26"
          />
        </div>
      </div>

      <div className="form-section-label">Datenquelle</div>
      <div className="form-row">
        <div className="form-group">
          <label>Kursanbieter</label>
          <select value={quoteProvider} onChange={(e) => setQuoteProvider(e.target.value)}>
            <option value="yahoo">Yahoo Finance</option>
            <option value="fmp">Financial Modeling Prep (FMP)</option>
            <option value="alphavantage">Alpha Vantage (25 req/Tag)</option>
          </select>
        </div>
      </div>

      <div className="total-summary">
        <div className="total-row">
          <span>Kaufpreis (Menge × Preis)</span>
          <span>{formatDual(purchaseCostNative, purchaseCost, currency)}</span>
        </div>
        <div className="total-row">
          <span>Kaufgebühren gesamt</span>
          <span>{formatDual(toNative(purchaseFee), purchaseFee, currency)}</span>
        </div>
        <div className="total-row">
          <span>Verkaufsgebühren (Schätzung)</span>
          <span>{formatDual(toNative(sellFee), sellFee, currency)}</span>
        </div>
        <div className="total-row total-row-final">
          <span>Gesamtkaufpreis</span>
          <span>{formatDual(toNative(totalCost), totalCost, currency)}</span>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Wird hinzugefügt...' : 'Investment hinzufügen'}
        </button>
      </div>
    </form>
  );
};

export default AddPositionForm;
