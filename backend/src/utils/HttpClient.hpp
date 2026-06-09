#ifndef HTTP_CLIENT_UTILS_H
#define HTTP_CLIENT_UTILS_H

#include <curl/curl.h>
#include <string>
#include <stdexcept>

class HttpClient {
public:
  static std::string get(const std::string& url) {
    CURL* curl = curl_easy_init();
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

    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
      throw std::runtime_error(std::string("HTTP request failed: ") + curl_easy_strerror(res));
    }

    if (httpCode < 200 || httpCode >= 300) {
      throw std::runtime_error("HTTP request to '" + url + "' returned status " + std::to_string(httpCode));
    }

    return response;
  }

private:
  static size_t writeCallback(void* contents, size_t size, size_t nmemb, std::string* response) {
    size_t totalSize = size * nmemb;
    response->append(static_cast<char*>(contents), totalSize);
    return totalSize;
  }
};

#endif // HTTP_CLIENT_UTILS_H
