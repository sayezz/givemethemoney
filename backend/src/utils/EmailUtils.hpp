#ifndef EMAIL_UTILS_H
#define EMAIL_UTILS_H

#include <curl/curl.h>
#include <string>
#include <algorithm>
#include <cstring>

class EmailUtils {
  struct Payload {
    std::string data;
    size_t pos = 0;
  };

  static size_t readCallback(char* ptr, size_t size, size_t nmemb, void* ud) {
    Payload* p = static_cast<Payload*>(ud);
    size_t rem = p->data.size() - p->pos;
    if (!rem) return 0;
    size_t n = std::min(size * nmemb, rem);
    memcpy(ptr, p->data.c_str() + p->pos, n);
    p->pos += n;
    return n;
  }

public:
  // Returns empty string on success, error message on failure.
  // smtpUrl examples:
  //   smtps://smtp.gmail.com:465    (TLS from start)
  //   smtp://smtp.gmail.com:587     (STARTTLS)
  static std::string send(
    const std::string& smtpUrl,
    const std::string& username,
    const std::string& password,
    const std::string& fromAddr,
    const std::string& toAddr,
    const std::string& subject,
    const std::string& body
  ) {
    CURL* curl = curl_easy_init();
    if (!curl) return "curl_easy_init failed";

    Payload payload;
    payload.data =
      "From: GiveMeTheMoney <" + fromAddr + ">\r\n"
      "To: <" + toAddr + ">\r\n"
      "Subject: " + subject + "\r\n"
      "Content-Type: text/plain; charset=UTF-8\r\n"
      "\r\n" +
      body + "\r\n";

    struct curl_slist* rcpt = curl_slist_append(nullptr, ("<" + toAddr + ">").c_str());

    curl_easy_setopt(curl, CURLOPT_URL,           smtpUrl.c_str());
    curl_easy_setopt(curl, CURLOPT_USERNAME,      username.c_str());
    curl_easy_setopt(curl, CURLOPT_PASSWORD,      password.c_str());
    curl_easy_setopt(curl, CURLOPT_MAIL_FROM,     ("<" + fromAddr + ">").c_str());
    curl_easy_setopt(curl, CURLOPT_MAIL_RCPT,     rcpt);
    curl_easy_setopt(curl, CURLOPT_READFUNCTION,  readCallback);
    curl_easy_setopt(curl, CURLOPT_READDATA,      &payload);
    curl_easy_setopt(curl, CURLOPT_UPLOAD,        1L);
    curl_easy_setopt(curl, CURLOPT_USE_SSL,       (long)CURLUSESSL_ALL);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT,       15L);

    CURLcode res = curl_easy_perform(curl);
    std::string err = (res != CURLE_OK) ? curl_easy_strerror(res) : "";

    curl_slist_free_all(rcpt);
    curl_easy_cleanup(curl);
    return err;
  }
};

#endif // EMAIL_UTILS_H
