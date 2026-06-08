cmake_minimum_required(VERSION 3.16)
project(investment_tracker_backend)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(oatpp 1.3.0 REQUIRED)
find_package(oatpp-postgresql 1.3.0 REQUIRED)
find_package(OpenSSL REQUIRED)

# Source files
file(GLOB_RECURSE APP_SOURCES 
  "src/*.cpp"
)

# Create executable
add_executable(investment_tracker ${APP_SOURCES})

# Link libraries
target_link_libraries(investment_tracker
  oatpp::oatpp
  oatpp::oatpp-postgresql
  OpenSSL::Crypto
  OpenSSL::SSL
)

# Include directories
target_include_directories(investment_tracker PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
