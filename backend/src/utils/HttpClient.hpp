#ifndef HTTP_CLIENT_UTILS_H
#define HTTP_CLIENT_UTILS_H

#include <curl/curl.h>
#include <string>
#include <stdexcept>
#include <mutex>
#include <unordered_map>
#include <chrono>

class HttpClient {
public:
  // Time-to-live for cached successful responses. Quote/FX/search lookups for
  // the same URL within this window are served from memory, which de-duplicates
  // dashboard fan-out and protects rate-limited providers (e.g. Alpha Vantage,
  // 25 requests/day).
  static constexpr int kCacheTtlSeconds = 15;

  static std::string get(const std::string& url) {
    if (std::string cached; cacheLookup(url, cached)) {
      return cached;
    }
    std::string body = fetch(url);
    cacheStore(url, body);
    return body;
  }

private:
  static std::string fetch(const std::string& url) {
    // Reuse one curl handle per thread so TCP/TLS connections are kept alive
    // across requests (oatpp serves each connection on its own thread). This
    // avoids a fresh handshake for every quote/FX lookup.
    CURL* curl = handle();
    if (!curl) {
      throw std::runtime_error("Failed to initialize curl");
    }

    std::string response;

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, &HttpClient::writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "Mozilla/5.0 (compatible; InvestmentTracker/1.0)");
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 2L);

    CURLcode res = curl_easy_perform(curl);

    long httpCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);

    if (res != CURLE_OK) {
      throw std::runtime_error(std::string("HTTP request failed: ") + curl_easy_strerror(res));
    }

    if (httpCode < 200 || httpCode >= 300) {
      throw std::runtime_error("HTTP request to '" + url + "' returned status " + std::to_string(httpCode));
    }

    return response;
  }

  struct CacheEntry {
    std::string body;
    std::chrono::steady_clock::time_point expiresAt;
  };

  static std::mutex& cacheMutex() {
    static std::mutex m;
    return m;
  }

  static std::unordered_map<std::string, CacheEntry>& cache() {
    static std::unordered_map<std::string, CacheEntry> c;
    return c;
  }

  static bool cacheLookup(const std::string& url, std::string& out) {
    std::lock_guard<std::mutex> lock(cacheMutex());
    auto it = cache().find(url);
    if (it == cache().end()) return false;
    if (std::chrono::steady_clock::now() >= it->second.expiresAt) {
      cache().erase(it);
      return false;
    }
    out = it->second.body;
    return true;
  }

  static void cacheStore(const std::string& url, const std::string& body) {
    std::lock_guard<std::mutex> lock(cacheMutex());
    cache()[url] = CacheEntry{
      body,
      std::chrono::steady_clock::now() + std::chrono::seconds(kCacheTtlSeconds)
    };
  }

  // One curl handle per thread, cleaned up automatically when the thread exits.
  static CURL* handle() {
    struct HandleGuard {
      CURL* h = curl_easy_init();
      ~HandleGuard() { if (h) curl_easy_cleanup(h); }
    };
    thread_local HandleGuard guard;
    if (guard.h) {
      curl_easy_reset(guard.h);
    }
    return guard.h;
  }

  static size_t writeCallback(void* contents, size_t size, size_t nmemb, std::string* response) {
    size_t totalSize = size * nmemb;
    response->append(static_cast<char*>(contents), totalSize);
    return totalSize;
  }
};

#endif // HTTP_CLIENT_UTILS_H
