#ifndef UTILS_PASSWORD_H
#define UTILS_PASSWORD_H

#include <string>
#include <stdexcept>
#include <cstdio>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/crypto.h>
#include <cstring>

class PasswordUtils {
public:
  // Simple PBKDF2 password hashing (production should use bcrypt library)
  static std::string hash(const std::string& password) {
    unsigned char salt[16];
    unsigned char hash[32];
    
    if (RAND_bytes(salt, sizeof(salt)) != 1) {
      throw std::runtime_error("Failed to generate salt");
    }

    if (PKCS5_PBKDF2_HMAC(password.c_str(), password.length(),
                          salt, sizeof(salt),
                          100000, EVP_sha256(),
                          sizeof(hash), hash) != 1) {
      throw std::runtime_error("Failed to hash password");
    }

    // Return hex encoded salt + hash
    return toHex(salt, sizeof(salt)) + toHex(hash, sizeof(hash));
  }

  static bool verify(const std::string& password, const std::string& hash) {
    if (hash.length() != 96) return false; // 16 bytes salt + 32 bytes hash = 96 hex chars

    std::string saltHex = hash.substr(0, 32);
    std::string hashHex = hash.substr(32, 64);

    unsigned char salt[16];
    unsigned char expected[32];
    unsigned char computed[32];

    // Convert hex back to binary
    fromHex(saltHex, salt, sizeof(salt));
    fromHex(hashHex, expected, sizeof(expected));

    // Compute hash with same salt
    if (PKCS5_PBKDF2_HMAC(password.c_str(), password.length(),
                          salt, sizeof(salt),
                          100000, EVP_sha256(),
                          sizeof(computed), computed) != 1) {
      return false;
    }

    // Constant time comparison
    return CRYPTO_memcmp(computed, expected, sizeof(computed)) == 0;
  }

private:
  static std::string toHex(const unsigned char* data, size_t len) {
    std::string result;
    for (size_t i = 0; i < len; ++i) {
      char buf[3];
      snprintf(buf, sizeof(buf), "%02x", data[i]);
      result += buf;
    }
    return result;
  }

  static void fromHex(const std::string& hex, unsigned char* data, size_t len) {
    for (size_t i = 0; i < len; ++i) {
      sscanf(hex.c_str() + i * 2, "%2hhx", &data[i]);
    }
  }
};

#endif // UTILS_PASSWORD_H
