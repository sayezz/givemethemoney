#ifndef DOMAIN_MODEL_DTOs_H
#define DOMAIN_MODEL_DTOs_H

#include "oatpp/core/Types.hpp"
#include "oatpp/core/macro/codegen.hpp"

/* Forward declaration of DTOs */

#include OATPP_CODEGEN_BEGIN(DTO)

class UserDto : public oatpp::DTO {
  DTO_INIT(UserDto, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(String, email);
  DTO_FIELD(String, created_at);
};

class UserAuthRow : public oatpp::DTO {
  DTO_INIT(UserAuthRow, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(String, email);
  DTO_FIELD(String, password_hash);
  DTO_FIELD(String, created_at);
};

class AuthRequestDto : public oatpp::DTO {
  DTO_INIT(AuthRequestDto, DTO)

  DTO_FIELD(String, email);
  DTO_FIELD(String, password);
};

class AuthResponseDto : public oatpp::DTO {
  DTO_INIT(AuthResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(String, message);
  DTO_FIELD(String, token);
  DTO_FIELD(Object<UserDto>, user);
};

class ErrorResponseDto : public oatpp::DTO {
  DTO_INIT(ErrorResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(String, message);
};

class PositionDto : public oatpp::DTO {
  DTO_INIT(PositionDto, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(String, name);
  DTO_FIELD(String, ticker);
  DTO_FIELD(Float64, quantity);
  DTO_FIELD(Float64, purchase_cost);
  DTO_FIELD(Float64, purchase_fee);
  DTO_FIELD(Float64, purchase_fee_fixed);
  DTO_FIELD(Float64, purchase_fee_percent);
  DTO_FIELD(Float64, sell_fee);
  DTO_FIELD(Float64, sell_fee_fixed);
  DTO_FIELD(Float64, sell_fee_percent);
  DTO_FIELD(Float64, tax_rate);
  DTO_FIELD(Float64, highest_price, "highest_price");
  DTO_FIELD(Float64, trailing_stop_percent, "trailing_stop_percent");
  DTO_FIELD(Boolean, trailing_stop_active);
  DTO_FIELD(Boolean, ts_notification_sent);
  DTO_FIELD(String, quote_provider);
  DTO_FIELD(String, created_at);
};

class TrailingStopRequestDto : public oatpp::DTO {
  DTO_INIT(TrailingStopRequestDto, DTO)
  DTO_FIELD(Boolean, trailing_stop_active);
};

class NotifyTrailingStopRequestDto : public oatpp::DTO {
  DTO_INIT(NotifyTrailingStopRequestDto, DTO)
  DTO_FIELD(Float64, current_price);
  DTO_FIELD(String,  ticker);
  DTO_FIELD(String,  name);
};

class UpdateProviderRequestDto : public oatpp::DTO {
  DTO_INIT(UpdateProviderRequestDto, DTO)
  DTO_FIELD(String, quote_provider);
};

class FmpQuoteItemDto : public oatpp::DTO {
  DTO_INIT(FmpQuoteItemDto, DTO)
  DTO_FIELD(String, symbol);
  DTO_FIELD(String, name);
  DTO_FIELD(Float64, price);
  DTO_FIELD(String, currency);
};

class AlphaVantageInnerQuoteDto : public oatpp::DTO {
  DTO_INIT(AlphaVantageInnerQuoteDto, DTO)
  DTO_FIELD(String, avSymbol, "01. symbol");
  DTO_FIELD(String, avPrice,  "05. price");
};

class AlphaVantageResponseDto : public oatpp::DTO {
  DTO_INIT(AlphaVantageResponseDto, DTO)
  DTO_FIELD(Object<AlphaVantageInnerQuoteDto>, globalQuote, "Global Quote");
};

class PositionsListResponseDto : public oatpp::DTO {
  DTO_INIT(PositionsListResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(Vector<Object<PositionDto>>, positions);
};

class PositionResponseDto : public oatpp::DTO {
  DTO_INIT(PositionResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(String, message);
  DTO_FIELD(Object<PositionDto>, position);
};

class StockSearchResultDto : public oatpp::DTO {
  DTO_INIT(StockSearchResultDto, DTO)

  DTO_FIELD(String, symbol);
  DTO_FIELD(String, name);
  DTO_FIELD(String, exchange);
};

class StockSearchResponseDto : public oatpp::DTO {
  DTO_INIT(StockSearchResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(String, message);
  DTO_FIELD(Vector<Object<StockSearchResultDto>>, results);
};

class StockQuoteDto : public oatpp::DTO {
  DTO_INIT(StockQuoteDto, DTO)

  DTO_FIELD(String, symbol);
  DTO_FIELD(String, name);
  DTO_FIELD(String, currency);
  DTO_FIELD(Float64, price);
};

class StockQuoteResponseDto : public oatpp::DTO {
  DTO_INIT(StockQuoteResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(String, message);
  DTO_FIELD(Object<StockQuoteDto>, quote);
};

/* DTOs for parsing the Yahoo Finance API responses */

class YahooSearchQuoteDto : public oatpp::DTO {
  DTO_INIT(YahooSearchQuoteDto, DTO)

  DTO_FIELD(String, symbol);
  DTO_FIELD(String, shortname);
  DTO_FIELD(String, longname);
  DTO_FIELD(String, exchange);
  DTO_FIELD(String, exchDisp);
  DTO_FIELD(String, quoteType);
};

class YahooSearchResponseDto : public oatpp::DTO {
  DTO_INIT(YahooSearchResponseDto, DTO)

  DTO_FIELD(Vector<Object<YahooSearchQuoteDto>>, quotes);
};

class YahooChartMetaDto : public oatpp::DTO {
  DTO_INIT(YahooChartMetaDto, DTO)

  DTO_FIELD(String, symbol);
  DTO_FIELD(String, currency);
  DTO_FIELD(String, longName);
  DTO_FIELD(String, shortName);
  DTO_FIELD(String, fullExchangeName);
  DTO_FIELD(Float64, regularMarketPrice);
  DTO_FIELD(Float64, fiftyTwoWeekHigh);
  DTO_FIELD(Float64, fiftyTwoWeekLow);
  DTO_FIELD(Float64, regularMarketDayHigh);
  DTO_FIELD(Float64, regularMarketDayLow);
  DTO_FIELD(Float64, regularMarketVolume);
};

class YahooChartResultDto : public oatpp::DTO {
  DTO_INIT(YahooChartResultDto, DTO)

  DTO_FIELD(Object<YahooChartMetaDto>, meta);
};

class YahooChartDto : public oatpp::DTO {
  DTO_INIT(YahooChartDto, DTO)

  DTO_FIELD(Vector<Object<YahooChartResultDto>>, result);
};

class YahooChartResponseDto : public oatpp::DTO {
  DTO_INIT(YahooChartResponseDto, DTO)

  DTO_FIELD(Object<YahooChartDto>, chart);
};

class HealthResponseDto : public oatpp::DTO {
  DTO_INIT(HealthResponseDto, DTO)

  DTO_FIELD(String, status);
};

class AlphaVantageOverviewDto : public oatpp::DTO {
  DTO_INIT(AlphaVantageOverviewDto, DTO)
  DTO_FIELD(String, avPeRatio,       "PERatio");
  DTO_FIELD(String, avForwardPE,     "ForwardPE");
  DTO_FIELD(String, avDividendYield, "DividendYield");
  DTO_FIELD(String, avDividendPerShare, "DividendPerShare");
  DTO_FIELD(String, avEps,           "EPS");
  DTO_FIELD(String, avAnalystTarget, "AnalystTargetPrice");
  DTO_FIELD(String, avPegRatio,      "PEGRatio");
  DTO_FIELD(String, avBeta,          "Beta");
  DTO_FIELD(String, avSector,        "Sector");
  DTO_FIELD(String, avIndustry,      "Industry");
};

class FmpProfileDto : public oatpp::DTO {
  DTO_INIT(FmpProfileDto, DTO)
  DTO_FIELD(String, symbol);
  DTO_FIELD(String, companyName);
  DTO_FIELD(String, isin);
  DTO_FIELD(String, currency);
  DTO_FIELD(String, exchange);
  DTO_FIELD(String, exchangeFullName);
  DTO_FIELD(Float64, lastDividend);
  DTO_FIELD(String, sector);
  DTO_FIELD(String, industry);
  DTO_FIELD(String, description);
};

class StockDetailDto : public oatpp::DTO {
  DTO_INIT(StockDetailDto, DTO)
  DTO_FIELD(String,   symbol);
  DTO_FIELD(String,   name);
  DTO_FIELD(String,   currency);
  DTO_FIELD(String,   exchange);
  DTO_FIELD(String,   isin);
  DTO_FIELD(String,   sector);
  DTO_FIELD(String,   industry);
  DTO_FIELD(String,   description);
  DTO_FIELD(Float64,  price);
  DTO_FIELD(Float64,  dayHigh);
  DTO_FIELD(Float64,  dayLow);
  DTO_FIELD(Float64,  volume);
  DTO_FIELD(Float64,  fiftyTwoWeekHigh);
  DTO_FIELD(Float64,  fiftyTwoWeekLow);
  DTO_FIELD(Float64,  trailingPE);
  DTO_FIELD(Float64,  forwardPE);
  DTO_FIELD(Float64,  pegRatio);
  DTO_FIELD(Float64,  eps);
  DTO_FIELD(Float64,  beta);
  DTO_FIELD(Float64,  dividendYield);
  DTO_FIELD(Float64,  dividendPerShare);
  DTO_FIELD(Float64,  lastDividendAmount);
  DTO_FIELD(Float64,  analystTargetPrice);
};

class StockDetailResponseDto : public oatpp::DTO {
  DTO_INIT(StockDetailResponseDto, DTO)
  DTO_FIELD(Boolean, success);
  DTO_FIELD(Object<StockDetailDto>, detail);
};

#include OATPP_CODEGEN_END(DTO)

#endif // DOMAIN_MODEL_DTOs_H
