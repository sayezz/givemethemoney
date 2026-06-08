FROM debian:bookworm-slim AS builder

RUN apt-get update -o Acquire::Retries=5 \
        && apt-get install -y --no-install-recommends \
            build-essential \
            cmake \
            git \
            ca-certificates \
            libssl-dev \
            libpq-dev \
        && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install oatpp
RUN git clone --depth 1 --branch 1.3.0 https://github.com/oatpp/oatpp.git \
    && cd oatpp \
    && mkdir build && cd build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release \
    && make -j"$(nproc)" install

# Install oatpp-postgresql
RUN git clone --depth 1 --branch 1.3.0 https://github.com/oatpp/oatpp-postgresql.git \
    && cd oatpp-postgresql \
    && mkdir build && cd build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release \
    && make -j"$(nproc)" install

# Copy and build our application
COPY . /app
WORKDIR /app
RUN mkdir build \
    && cd build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release \
    && make -j"$(nproc)"

# Runtime image
FROM debian:bookworm-slim

RUN apt-get update -o Acquire::Retries=5 \
    && apt-get install -y --no-install-recommends \
      libssl3 \
      libpq5 \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib /usr/local/lib
COPY --from=builder /app/build/investment_tracker /app/investment_tracker

RUN strip /app/investment_tracker || true

ENV LD_LIBRARY_PATH=/usr/local/lib

EXPOSE 3001

CMD ["/app/investment_tracker"]
