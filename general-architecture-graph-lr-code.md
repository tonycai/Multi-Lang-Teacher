# General Architecture Graph (Left-to-Right) for Multi-Lang-Teacher (with Pinecone)

```mermaid
graph LR
    subgraph User
        A[Student (Mainland China)] -- Interacts with --> B(User Interface - Web/App)
    end

    subgraph AWS Cloud
        subgraph Bedrock
            C[Claude Sonnet 3.x / Other LLMs]
            D[Agents for Bedrock]
        end

        subgraph Backend (API & Logic)
            F[API Gateway] -- Routes Requests to --> G(Lambda Function - Main Logic)
            G -- Interacts with --> H(Agents for Bedrock)
            G -- Interacts with --> I[Lambda Function - Pinecone Interaction]
            G -- Interacts with --> J(Lambda Function - Data Processing/Storage)
            J -- Stores/Retrieves Metadata from --> K[DynamoDB]
            J -- Stores Raw Learning Materials in --> L[S3]
            I -- Queries --> M[Pinecone Vector Database]
        end

        subgraph Deployment & Infrastructure
            N[CDK Bootstrap] -- Sets up AWS Environment for --> O(CDK Deploy)
            O -- Deploys Infrastructure --> F
            O -- Deploys Infrastructure --> G
            O -- Deploys Infrastructure --> I
            O -- Deploys Infrastructure --> J
            O -- Configures --> C
            O -- Configures --> D
            O -- Configures IAM Roles & Permissions --> ALL_AWS_RESOURCES
            O -- Provisions Pinecone Credentials (Securely) --> I
        end
    end

    B -- Sends Requests to --> F
    F -- Authenticates/Authorizes --> G
    H -- Invokes --> C
    C -- Generates Initial Response --> H
    G -- Triggers Vector Search via --> I
    I -- Queries Embeddings in --> M
    M -- Returns Relevant Document IDs/Vectors to --> I
    I -- Retrieves Corresponding Metadata from --> K
    I -- Passes Relevant Context to --> G
    G -- Formulates Final Response using LLM & Context --> B
    B -- Displays Response to --> A
