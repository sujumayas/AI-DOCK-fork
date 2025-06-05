import openai

# Replace with your actual API key
client = openai.OpenAI(api_key="***REMOVED***")

def chat():
    print("Welcome to ChatGPT! Type 'exit' to quit.")
    messages = [{"role": "system", "content": "You are a helpful assistant."}]
    
    while True:
        user_input = input("You: ")
        if user_input.lower() in {"exit", "quit"}:
            break

        messages.append({"role": "user", "content": user_input})
        
        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages
            )
            reply = response.choices[0].message.content.strip()
            print("ChatGPT:", reply)
            messages.append({"role": "assistant", "content": reply})
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    chat()
