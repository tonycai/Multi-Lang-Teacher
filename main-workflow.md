# Main Workflow for Multi-Lang-Teacher

## 1. Introduction

This document outlines the main workflow for the Multi-Lang-Teacher project, an AI-powered private teacher agent built using AWS Bedrock (specifically leveraging a suitable Large Language Model like Claude Sonnet 3.5 or similar). This agent assists students from mainland China in learning English and Japanese, utilizing Simple Chinese for explanations and pronunciation guidance when needed.

## 2. Core Functionality & User Interaction

The primary goal is to provide students with personalized learning support in English and Japanese, with the flexibility to receive explanations and clarifications in their native language (Simple Chinese).

**Main Steps:**

1.  **User Interaction Initiation:** The student interacts with the Multi-Lang-Teacher through a user interface (e.g., chat-based, web application).

2.  **Language Selection (Implicit/Explicit):**
    * **Implicit:** The agent may attempt to infer the student's current learning language based on their query (e.g., asking an English question implies English learning).
    * **Explicit:** The student may explicitly indicate the language they are currently studying (English or Japanese) or the language they want to receive explanations in (English, Japanese, or Simple Chinese).

3.  **Student Query Input:** The student asks a question or requests assistance related to English or Japanese language learning. This could include:
    * Grammar questions
    * Vocabulary definitions
    * Pronunciation guidance
    * Example sentences
    * Cultural context
    * Requests for feedback on written work
    * Requests for practice exercises

4.  **Prompt Engineering for the LLM (e.g., Claude Sonnet 3.5):** Based on the student's query and the selected/inferred language context, the system crafts a well-structured prompt for the underlying LLM via the AWS Bedrock API. This prompt will:
    * Clearly state the student's question or request.
    * Specify the target learning language (English or Japanese).
    * Indicate the preferred language for the response and explanations (English, Japanese, or Simple Chinese).
    * Include any relevant context from previous interactions.
    * Instruct the LLM on the desired format of the response (e.g., text explanation, code block for examples, pronunciation guidance).

5.  **LLM Processing (e.g., Claude Sonnet 3.5):** The carefully engineered prompt is sent to the chosen LLM via the AWS Bedrock API. The LLM processes the query, leveraging its knowledge base and language generation capabilities.

6.  **Response Generation:** The LLM generates a response tailored to the student's question and the specified language preferences. This could include:
    * Explanations in English, Japanese, or Simple Chinese.
    * Vocabulary definitions and translations.
    * Pinyin pronunciation for English words.
    * Explanations of Japanese pronunciation using Simple Chinese phonetic approximations.
    * Example sentences in the target language.
    * Feedback on written work (if the query included it).
    * Practice questions or exercises.

7.  **Output and Presentation:** The generated response is received from the Bedrock API and presented to the student through the user interface.

8.  **User Feedback and Follow-up:** The student reviews the response and can:
    * Ask follow-up questions.
    * Request further clarification in a specific language.
    * Indicate if the response was helpful or not.
    * Provide feedback on the accuracy or clarity of the information.

9.  **Iterative Refinement (Internal):** Based on user feedback and ongoing monitoring, the system can:
    * Adjust the prompt engineering strategies for better response quality.
    * Update the underlying knowledge base or fine-tune the LLM (if necessary) to improve accuracy and address common student difficulties.
    * Identify areas where the agent's performance can be enhanced.

## 3. Key Considerations for the LLM (e.g., Claude Sonnet 3.5)

* **Multilingual Capabilities:** The chosen LLM needs strong capabilities in understanding and generating coherent text in English, Japanese, and Simple Chinese.
* **Contextual Understanding:** The LLM should be able to maintain context across multiple turns of conversation to provide relevant and coherent support.
* **Nuance in Language:** The LLM should be sensitive to the nuances of grammar, vocabulary, and cultural context in all three languages.
* **Pronunciation Assistance:** The LLM needs to be capable of providing accurate pronunciation guidance, potentially leveraging knowledge of phonetics and cross-linguistic sound similarities.
* **Code Generation for Examples/Exercises:** If the agent includes coding examples or interactive exercises, the LLM should be proficient in generating relevant and correct code snippets.

## 4. Potential Extensions and Advanced Workflows

* **Personalized Learning Paths:** Tailoring content and pace based on individual student progress and learning styles.
* **Adaptive Quizzes:** Generating quizzes that adjust difficulty based on student performance.
* **Integration with External Resources:** Linking to relevant online dictionaries, grammar guides, or cultural resources.
* **Voice Input/Output:** Allowing students to interact with the agent using voice and receive spoken responses.
* **Error Analysis and Targeted Feedback:** Identifying common errors in student writing and providing specific guidance for improvement.

## 5. Conclusion

This workflow outlines the core interaction between the student and the Multi-Lang-Teacher agent powered by an LLM like Claude Sonnet 3.5 on AWS Bedrock. The emphasis is on providing multilingual support and leveraging Simple Chinese to enhance the learning experience for students from mainland China learning English and Japanese. Continuous monitoring and refinement based on user interaction will be crucial for the ongoing improvement of the agent's effectiveness.
