#ifndef STOCKS_CONTROLLER_H
#define STOCKS_CONTROLLER_H

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/core/macro/codegen.hpp"
#include "oatpp/core/macro/component.hpp"
#include "../dto/DTOs.hpp"
#include "../utils/CorsUtils.hpp"
#include "../utils/HttpClient.hpp"
#include "../utils/JwtUtils.hpp"

#include <curl/curl.h>

#include <memory>
#include <cstdlib>
#include <string>

#include OATPP_CODEGEN_BEGIN(ApiController)

class StocksController : public oatpp::web::server::api::ApiController {
public:
  explicit StocksController(const std::shared_ptr<ObjectMapper>& objectMapper)
    : oatpp::web::server::api::ApiController(objectMapper),
      m_objectMapper(objectMapper) {
    const char* secret = std::getenv("JWT_SECRET");
    m_jwtSecret = secret ? secret : "investment-tracker-dev-secret";
  }

  ENDPOINT_INFO(searchStocks) {
    info->summary = "Search for stocks by name or ticker symbol";
    info->addResponse<Object<StockSearchResponseDto>>(Status::CODE_200, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_401, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_502, "application/json");
  }
  ENDPOINT("GET", "/api/stocks/search", searchStocks,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           QUERY(String, q)) {
    int userId = 0;
    auto authError = authenticate(request, userId);
    if (authError) {
      return authError;
    }

    auto response = StockSearchResponseDto::createShared();
    response->success = true;
    response->results = oatpp::Vector<oatpp::Object<StockSearchResultDto>>::createShared();

    if (!q || q->empty()) {
      return createCorsDtoResponse(Status::CODE_200, response);
    }

    try {
      std::string url = "https://query1.finance.yahoo.com/v1/finance/search?quotesCount=8&newsCount=0&q=" + urlEncode(*q);
      std::string body = HttpClient::get(url);

      auto parsed = m_objectMapper->readFromString<oatpp::Object<YahooSearchResponseDto>>(body);

      if (parsed && parsed->quotes) {
        for (const auto& quote : *parsed->quotes) {
          if (!quote || !quote->symbol) {
            continue;
          }
          if (quote->quoteType && *quote->quoteType != "EQUITY" && *quote->quoteType != "ETF") {
            continue;
          }

          auto item = StockSearchResultDto::createShared();
          item->symbol = quote->symbol;
          item->name = quote->longname ? quote->longname : (quote->shortname ? quote->shortname : quote->symbol);
          item->exchange = quote->exchDisp ? quote->exchDisp : quote->exchange;
          response->results->push_back(item);
        }
      }

      return createCorsDtoResponse(Status::CODE_200, response);

    } catch (const std::exception& e) {
      return errorResponse(Status::CODE_502, std::string("Stock search failed: ") + e.what());
    }
  }

  ENDPOINT("OPTIONS", "/api/stocks/search", optionsSearchStocks) {
    return createCorsPreflightResponse();
  }

  ENDPOINT_INFO(getQuote) {
    info->summary = "Get the current market price for a stock ticker symbol";
    info->addResponse<Object<StockQuoteResponseDto>>(Status::CODE_200, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_400, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_401, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_404, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_502, "application/json");
  }
  ENDPOINT("GET", "/api/stocks/quote", getQuote,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           QUERY(String, symbol),
           QUERY(String, provider, "provider", "yahoo")) {
    int userId = 0;
    auto authError = authenticate(request, userId);
    if (authError) return authError;

    if (!symbol || symbol->empty()) {
      return errorResponse(Status::CODE_400, "Query parameter 'symbol' is required");
    }

    std::string providerStr = provider ? std::string(*provider) : "yahoo";

    if (providerStr == "fmp") {
      return getQuoteFmp(*symbol);
    } else if (providerStr == "alphavantage") {
      return getQuoteAlphaVantage(*symbol);
    }
    return getQuoteYahoo(*symbol);
  }

  ENDPOINT("OPTIONS", "/api/stocks/quote", optionsQuote) {
    return createCorsPreflightResponse();
  }

  ENDPOINT_INFO(getDetails) {
    info->summary = "Get detailed stock info (PE, dividend, 52W range, ISIN)";
    info->addResponse<Object<StockDetailResponseDto>>(Status::CODE_200, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_400, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_401, "application/json");
  }
  ENDPOINT("GET", "/api/stocks/details", getDetails,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           QUERY(String, symbol)) {
    int userId = 0;
    auto authError = authenticate(request, userId);
    if (authError) return authError;

    if (!symbol || symbol->empty())
      return errorResponse(Status::CODE_400, "Query parameter 'symbol' is required");

    auto detail = StockDetailDto::createShared();
    detail->symbol = symbol;
    detail->name   = symbol;

    // 1. Yahoo Finance v8 chart — price, day range, 52W, name, exchange
    try {
      std::string url = "https://query1.finance.yahoo.com/v8/finance/chart/" + urlEncode(*symbol) + "?interval=1d&range=1d";
      std::string body = HttpClient::get(url);
      auto parsed = m_objectMapper->readFromString<oatpp::Object<YahooChartResponseDto>>(body);
      if (parsed && parsed->chart && parsed->chart->result && parsed->chart->result->size() > 0) {
        auto meta = (*parsed->chart->result)[0]->meta;
        if (meta) {
          if (meta->longName)       detail->name = meta->longName;
          else if (meta->shortName) detail->name = meta->shortName;
          detail->currency        = meta->currency;
          detail->exchange        = meta->fullExchangeName;
          detail->price           = meta->regularMarketPrice;
          detail->dayHigh         = meta->regularMarketDayHigh;
          detail->dayLow          = meta->regularMarketDayLow;
          detail->volume          = meta->regularMarketVolume;
          detail->fiftyTwoWeekHigh = meta->fiftyTwoWeekHigh;
          detail->fiftyTwoWeekLow  = meta->fiftyTwoWeekLow;
        }
      }
    } catch (...) {}

    // 2. FMP stable/profile — ISIN, currency fallback, sector, industry, description, lastDividend
    const char* fmpKey = std::getenv("FMP_API_KEY");
    if (fmpKey && !std::string(fmpKey).empty()) {
      try {
        std::string url = "https://financialmodelingprep.com/stable/profile?symbol=" + urlEncode(*symbol) + "&apikey=" + std::string(fmpKey);
        std::string body = HttpClient::get(url);
        auto parsed = m_objectMapper->readFromString<oatpp::Vector<oatpp::Object<FmpProfileDto>>>(body);
        if (parsed && parsed->size() > 0) {
          auto prof = (*parsed)[0];
          if (prof->isin)     detail->isin     = prof->isin;
          if (prof->sector)   detail->sector   = prof->sector;
          if (prof->industry) detail->industry = prof->industry;
          if (prof->currency && !detail->currency) detail->currency = prof->currency;
          if (prof->exchangeFullName && !detail->exchange) detail->exchange = prof->exchangeFullName;
          else if (prof->exchange && !detail->exchange)    detail->exchange = prof->exchange;
          if (prof->lastDividend) detail->lastDividendAmount = prof->lastDividend;
          if (prof->description) {
            std::string desc = std::string(*prof->description);
            if (desc.length() > 400) desc = desc.substr(0, 400) + "…";
            detail->description = oatpp::String(desc.c_str());
          }
        }
      } catch (...) {}
    }

    // 3. Alpha Vantage OVERVIEW — PE, dividend yield, EPS, beta, analyst target
    const char* avKey = std::getenv("AV_API_KEY");
    if (avKey && !std::string(avKey).empty()) {
      try {
        std::string url = "https://www.alphavantage.co/query?function=OVERVIEW&symbol=" + urlEncode(*symbol) + "&apikey=" + std::string(avKey);
        std::string body = HttpClient::get(url);
        auto avData = m_objectMapper->readFromString<oatpp::Object<AlphaVantageOverviewDto>>(body);
        auto parseAv = [](const oatpp::String& s) -> double {
          if (!s || s->empty() || std::string(*s) == "None") return -1.0;
          try { return std::stod(std::string(*s)); } catch (...) { return -1.0; }
        };
        if (avData) {
          double v;
          if ((v = parseAv(avData->avPeRatio))       > 0) detail->trailingPE       = oatpp::Float64(v);
          if ((v = parseAv(avData->avForwardPE))      > 0) detail->forwardPE        = oatpp::Float64(v);
          if ((v = parseAv(avData->avPegRatio))       > 0) detail->pegRatio         = oatpp::Float64(v);
          if ((v = parseAv(avData->avDividendYield))  > 0) detail->dividendYield    = oatpp::Float64(v);
          if ((v = parseAv(avData->avDividendPerShare)) > 0) detail->dividendPerShare = oatpp::Float64(v);
          if ((v = parseAv(avData->avEps))            != -1.0) detail->eps          = oatpp::Float64(v);
          if ((v = parseAv(avData->avBeta))           != -1.0) detail->beta         = oatpp::Float64(v);
          if ((v = parseAv(avData->avAnalystTarget))  > 0) detail->analystTargetPrice = oatpp::Float64(v);
          if (avData->avSector   && !detail->sector)   detail->sector   = avData->avSector;
          if (avData->avIndustry && !detail->industry) detail->industry = avData->avIndustry;
        }
      } catch (...) {}
    }

    auto response = StockDetailResponseDto::createShared();
    response->success = true;
    response->detail  = detail;
    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT("OPTIONS", "/api/stocks/details", optionsDetails) {
    return createCorsPreflightResponse();
  }

private:
  template <class T>
  std::shared_ptr<OutgoingResponse> createCorsDtoResponse(const Status& status, const T& dto) {
    auto response = createDtoResponse(status, dto);
    CorsUtils::apply(response);
    return response;
  }

  std::shared_ptr<OutgoingResponse> createCorsPreflightResponse() {
    auto response = createResponse(Status::CODE_204, "");
    CorsUtils::apply(response);
    return response;
  }

  std::shared_ptr<OutgoingResponse> errorResponse(const Status& status, const std::string& message) {
    auto error = ErrorResponseDto::createShared();
    error->success = false;
    error->message = message;
    return createCorsDtoResponse(status, error);
  }

  std::shared_ptr<OutgoingResponse> getQuoteYahoo(const std::string& symbol) {
    try {
      std::string url = "https://query1.finance.yahoo.com/v8/finance/chart/" + urlEncode(symbol) + "?interval=1d&range=1d";
      std::string body = HttpClient::get(url);
      auto parsed = m_objectMapper->readFromString<oatpp::Object<YahooChartResponseDto>>(body);
      if (!parsed || !parsed->chart || !parsed->chart->result || parsed->chart->result->size() == 0)
        return errorResponse(Status::CODE_404, "No quote found for symbol '" + symbol + "'");
      auto meta = parsed->chart->result[0]->meta;
      if (!meta || !meta->regularMarketPrice)
        return errorResponse(Status::CODE_404, "No price available for symbol '" + symbol + "'");
      auto quote = StockQuoteDto::createShared();
      quote->symbol = meta->symbol ? meta->symbol : oatpp::String(symbol.c_str());
      quote->name   = meta->longName ? meta->longName : (meta->shortName ? meta->shortName : quote->symbol);
      quote->currency = meta->currency;
      quote->price    = meta->regularMarketPrice;
      auto response = StockQuoteResponseDto::createShared();
      response->success = true;
      response->quote   = quote;
      return createCorsDtoResponse(Status::CODE_200, response);
    } catch (const std::exception& e) {
      return errorResponse(Status::CODE_502, std::string("Yahoo quote failed: ") + e.what());
    }
  }

  std::shared_ptr<OutgoingResponse> getQuoteFmp(const std::string& symbol) {
    const char* apiKey = std::getenv("FMP_API_KEY");
    if (!apiKey || std::string(apiKey).empty())
      return errorResponse(Status::CODE_502, "FMP_API_KEY not configured");
    try {
      std::string url = "https://financialmodelingprep.com/stable/quote?symbol=" + urlEncode(symbol) + "&apikey=" + std::string(apiKey);
      std::string body = HttpClient::get(url);
      auto parsed = m_objectMapper->readFromString<oatpp::Vector<oatpp::Object<FmpQuoteItemDto>>>(body);
      if (!parsed || parsed->size() == 0)
        return errorResponse(Status::CODE_404, "No FMP quote found for symbol '" + symbol + "'");
      auto item = (*parsed)[0];
      if (!item || !item->price)
        return errorResponse(Status::CODE_404, "No price in FMP response for '" + symbol + "'");
      auto quote = StockQuoteDto::createShared();
      quote->symbol   = item->symbol ? item->symbol : oatpp::String(symbol.c_str());
      quote->name     = item->name ? item->name : quote->symbol;
      quote->currency = item->currency;
      quote->price    = item->price;
      auto response = StockQuoteResponseDto::createShared();
      response->success = true;
      response->quote   = quote;
      return createCorsDtoResponse(Status::CODE_200, response);
    } catch (const std::exception& e) {
      return errorResponse(Status::CODE_502, std::string("FMP quote failed: ") + e.what());
    }
  }

  std::shared_ptr<OutgoingResponse> getQuoteAlphaVantage(const std::string& symbol) {
    const char* apiKey = std::getenv("AV_API_KEY");
    if (!apiKey || std::string(apiKey).empty())
      return errorResponse(Status::CODE_502, "AV_API_KEY not configured");
    try {
      std::string url = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=" + urlEncode(symbol) + "&apikey=" + std::string(apiKey);
      std::string body = HttpClient::get(url);
      auto parsed = m_objectMapper->readFromString<oatpp::Object<AlphaVantageResponseDto>>(body);
      if (!parsed || !parsed->globalQuote || !parsed->globalQuote->avPrice || parsed->globalQuote->avPrice->empty())
        return errorResponse(Status::CODE_404, "No Alpha Vantage quote for symbol '" + symbol + "' (free tier: 25 req/day)");
      double price = std::stod(std::string(*parsed->globalQuote->avPrice));
      auto quote = StockQuoteDto::createShared();
      quote->symbol   = oatpp::String(symbol.c_str());
      quote->name     = oatpp::String(symbol.c_str());
      quote->currency = oatpp::String("USD");
      quote->price    = oatpp::Float64(price);
      auto response = StockQuoteResponseDto::createShared();
      response->success = true;
      response->quote   = quote;
      return createCorsDtoResponse(Status::CODE_200, response);
    } catch (const std::exception& e) {
      return errorResponse(Status::CODE_502, std::string("Alpha Vantage quote failed: ") + e.what());
    }
  }

  std::shared_ptr<OutgoingResponse> authenticate(const std::shared_ptr<IncomingRequest>& request, int& userId) {
    auto authHeader = request->getHeader("Authorization");
    if (!authHeader) {
      return errorResponse(Status::CODE_401, "Missing Authorization header");
    }

    std::string headerValue = *authHeader;
    const std::string prefix = "Bearer ";
    if (headerValue.rfind(prefix, 0) != 0) {
      return errorResponse(Status::CODE_401, "Invalid Authorization header");
    }

    std::string token = headerValue.substr(prefix.length());
    std::string email;
    if (!JwtUtils::verify(token, m_jwtSecret, userId, email)) {
      return errorResponse(Status::CODE_401, "Invalid or expired token");
    }

    return nullptr;
  }

  static std::string urlEncode(const std::string& value) {
    CURL* curl = curl_easy_init();
    if (!curl) {
      throw std::runtime_error("Failed to initialize curl for URL encoding");
    }
    char* encoded = curl_easy_escape(curl, value.c_str(), static_cast<int>(value.length()));
    std::string result = encoded ? encoded : "";
    if (encoded) {
      curl_free(encoded);
    }
    curl_easy_cleanup(curl);
    return result;
  }

  std::shared_ptr<ObjectMapper> m_objectMapper;
  std::string m_jwtSecret;
};

#include OATPP_CODEGEN_END(ApiController)

#endif // STOCKS_CONTROLLER_H
