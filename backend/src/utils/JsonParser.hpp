#ifndef RAPIDJSON_CONFIG_H
#define RAPIDJSON_CONFIG_H

// Simplified JSON parser for JWT parsing
#include <string>
#include <map>
#include <vector>

class JsonValue {
public:
  enum Type { JSON_NULL, JSON_BOOL, JSON_INT, JSON_DOUBLE, JSON_STRING, JSON_ARRAY, JSON_OBJECT };
  
  Type type;
  std::string stringValue;
  double numberValue;
  bool boolValue;
  std::map<std::string, JsonValue> objectValue;
  std::vector<JsonValue> arrayValue;
  
  JsonValue() : type(JSON_NULL), numberValue(0), boolValue(false) {}
};

class JsonParser {
public:
  static JsonValue parse(const std::string& json);
};

#endif // RAPIDJSON_CONFIG_H
