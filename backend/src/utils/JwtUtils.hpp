#ifndef JWT_UTILS_H
#define JWT_UTILS_H

#include <string>
#include <map>
#include <openssl/hmac.h>
#include <openssl/sha.h>
#include "oatpp/core/data/stream/BufferStream.hpp"
#include "oatpp/core/utils/ConversionUtils.hpp"

class JwtUtils {
public:
  static std::string encode(int userId, const std::string& email, const std::string& secret) {
    std::string header = R"({"alg":"HS256","typ":"JWT"})";
    std::string payload = std::string(R"({"id":)") + std::to_string(userId) + 
                         std::string(R"(,"email":"") + email + 
                         std::string(R"(","exp":)") + std::to_string(time(nullptr) + 604800) + "}";
    
    std::string headerEncoded = base64url_encode(header);
    std::string payloadEncoded = base64url_encode(payload);
    std::string signature = base64url_encode(hmacSha256(headerEncoded + "." + payloadEncoded, secret));
    
    return headerEncoded + "." + payloadEncoded + "." + signature;
  }

  static bool verify(const std::string& token, const std::string& secret, int& userId, std::string& email) {
    auto parts = split(token, '.');
    if (parts.size() != 3) return false;

    std::string signature = base64url_encode(hmacSha256(parts[0] + "." + parts[1], secret));
    if (signature != parts[2]) return false;

    // Decode payload (simple JSON parsing)
    std::string payloadJson = base64url_decode(parts[1]);
    
    // Extract user ID and email from JSON (simplified)
    size_t idPos = payloadJson.find("\"id\":");
    if (idPos != std::string::npos) {
      userId = std::stoi(payloadJson.substr(idPos + 5));
    }
    
    size_t emailPos = payloadJson.find("\"email\":\"");
    if (emailPos != std::string::npos) {
      size_t emailEnd = payloadJson.find("\"", emailPos + 9);
      email = payloadJson.substr(emailPos + 9, emailEnd - emailPos - 9);
    }

    return true;
  }

private:
  static std::string hmacSha256(const std::string& message, const std::string& key) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hashLen = 0;

    HMAC(EVP_sha256(), key.c_str(), key.length(),
         (unsigned char*)message.c_str(), message.length(),
         hash, &hashLen);

    return std::string((char*)hash, hashLen);
  }

  static std::string base64url_encode(const std::string& input) {
    static const char* base64_chars = 
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    
    std::string result;
    int val = 0, valb = 0;
    
    for (unsigned char c : input) {
      val = (val << 8) + c;
      valb += 8;
      while (valb >= 6) {
        valb -= 6;
        result.push_back(base64_chars[(val >> valb) & 0x3F]);
      }
    }
    if (valb > 0) result.push_back(base64_chars[(val << (6 - valb)) & 0x3F]);
    
    return result;
  }

  static std::string base64url_decode(const std::string& input) {
    static const std::string base64_chars = 
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    
    std::string result;
    std::vector<int> T(256, -1);
    for (int i = 0; i < 64; i++) T[base64_chars[i]] = i;
    
    int val = 0, valb = 0;
    for (unsigned char c : input) {
      if (T[c] == -1) break;
      val = (val << 6) + T[c];
      valb += 6;
      if (valb >= 8) {
        valb -= 8;
        result.push_back(char((val >> valb) & 0xFF));
      }
    }
    return result;
  }

  static std::vector<std::string> split(const std::string& s, char delimiter) {
    std::vector<std::string> tokens;
    std::string token;
    std::istringstream tokenStream(s);
    while (std::getline(tokenStream, token, delimiter)) {
      tokens.push_back(token);
    }
    return tokens;
  }
};

#endif // JWT_UTILS_H
