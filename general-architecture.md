# General Architecture: Multi-Lang-Teacher

## 1. Overview

The Multi-Lang-Teacher project is an AI-powered private teacher agent designed to assist students from mainland China in learning English and Japanese. It leverages the capabilities of Large Language Models (LLMs) accessed through AWS Bedrock, along with a vector database (Pinecone) for enhanced knowledge retrieval. The agent aims to provide personalized learning support, including explanations in English, Japanese, and Simple Chinese, pronunciation guidance, and feedback.

## 2. High-Level Architecture Diagram

```mermaid
graph LR
    A[Student (Mainland China)] -- Interacts with --> B(User Interface - Web/App)
    B -- Sends Requests to --> C(API Gateway)
    C -- Routes Requests to --> D(Lambda Function - Main Logic)
    D -- Interacts with --> E(Agents for Bedrock)
    D -- Interacts with --> F(Lambda Function - Pinecone Interaction)
    D -- Interacts with --> G(Lambda Function - Data Processing/Storage)
    F -- Queries --> H[Pinecone Vector Database]
    G -- Stores/Retrieves Metadata from --> I[DynamoDB]
    G -- Stores Raw Learning Materials in --> J[S3]
    E -- Invokes --> K[Claude Sonnet 3.x / Other LLMs]
    K -- Generates Response --> E
    H -- Returns Relevant Document IDs/Vectors to --> F
    F -- Retrieves Metadata from --> I
    D -- Formulates Response using LLM & Context --> B
