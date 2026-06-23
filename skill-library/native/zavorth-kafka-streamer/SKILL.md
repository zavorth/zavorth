---
name: Kafka Streamer
description: Apache Kafka topic and streaming management
license: Zavorth-Internal
---

# Kafka Streamer

Use this native skill when:
- The task requires operations in the 'data-engineering' domain.
- Performing actions matching: Apache Kafka topic management, producer/consumer, streaming.

## Operating Rules

- Configure topics with appropriate partition counts and replication factors for throughput needs.
- Implement exactly-once semantics using idempotent producers and transactional consumers when required.
- Use consumer groups with proper offset management for scalable message processing.
- Apply Schema Registry for Avro/Protobuf schema evolution and compatibility enforcement.
- Monitor consumer lag and broker health through JMX metrics and alerting.

## Output

- Kafka topic configurations, producer/consumer implementations, and stream processing topologies.
