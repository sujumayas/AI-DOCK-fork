#!/usr/bin/env python3
"""
🧪 OpenAI API Test Script (Updated for openai>=1.0.0)
This script tests your OpenAI API key with the modern library format
"""

from openai import OpenAI
import asyncio

# ✅ Modern OpenAI library format (v1.0+)
# Replace with your actual API key
API_KEY = "sk-your-openai-api-key-here"

def test_openai_sync():
    """Test OpenAI API with synchronous client (simpler)"""
    print("🔧 Testing OpenAI API (Synchronous)...")
    
    try:
        # ✅ Create client with modern API
        client = OpenAI(api_key=API_KEY)
        
        # ✅ New format: client.chat.completions.create()
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Is this API working? Please respond with 'Yes, API is working!'"}
            ],
            max_tokens=50,
            temperature=0.7
        )
        
        # ✅ Extract response content
        reply = response.choices[0].message.content
        print(f"✅ Success! ChatGPT says: {reply}")
        
        # 📊 Show usage information
        if hasattr(response, 'usage'):
            usage = response.usage
            print(f"📊 Token usage:")
            print(f"   Input tokens: {usage.prompt_tokens}")
            print(f"   Output tokens: {usage.completion_tokens}")
            print(f"   Total tokens: {usage.total_tokens}")
            
            # 💰 Estimate cost (GPT-3.5-turbo pricing)
            cost = (usage.prompt_tokens * 0.0005 + usage.completion_tokens * 0.0015) / 1000
            print(f"💰 Estimated cost: ${cost:.6f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        
        # 🔍 Specific error handling
        if "exceeded" in str(e).lower() or "quota" in str(e).lower():
            print("💡 Quota exceeded - check your OpenAI billing")
        elif "invalid" in str(e).lower() or "401" in str(e):
            print("💡 Invalid API key - check your key")
        elif "rate" in str(e).lower():
            print("💡 Rate limit - wait a moment and try again")
        
        return False

async def test_openai_async():
    """Test OpenAI API with async client (same as our backend)"""
    print("\n🔧 Testing OpenAI API (Asynchronous)...")
    
    try:
        # ✅ Import async client
        from openai import AsyncOpenAI
        
        # ✅ Create async client
        client = AsyncOpenAI(api_key=API_KEY)
        
        # ✅ Same API but with await
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "user", "content": "Hello from async test!"}
            ],
            max_tokens=30
        )
        
        reply = response.choices[0].message.content
        print(f"✅ Async Success! Response: {reply}")
        
        return True
        
    except Exception as e:
        print(f"❌ Async Error: {e}")
        return False

def interactive_chat():
    """Interactive chat session (like your original script but fixed)"""
    print("\n💬 Starting Interactive Chat...")
    print("💡 Type 'exit' or 'quit' to stop")
    print("-" * 40)
    
    try:
        client = OpenAI(api_key=API_KEY)
        
        while True:
            user_input = input("\n🙋 You: ").strip()
            
            if user_input.lower() in {"exit", "quit", "stop"}:
                print("👋 Goodbye!")
                break
            
            if not user_input:
                continue
            
            try:
                print("🤔 Thinking...")
                
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant. Keep responses concise."},
                        {"role": "user", "content": user_input}
                    ],
                    max_tokens=200,
                    temperature=0.7
                )
                
                reply = response.choices[0].message.content
                print(f"🤖 ChatGPT: {reply}")
                
                # Show cost
                if hasattr(response, 'usage'):
                    usage = response.usage
                    cost = (usage.prompt_tokens * 0.0005 + usage.completion_tokens * 0.0015) / 1000
                    print(f"💰 Cost: ${cost:.6f} | Tokens: {usage.total_tokens}")
                
            except Exception as e:
                print(f"❌ Chat error: {e}")
                if "quota" in str(e).lower():
                    print("💡 Quota exceeded - your OpenAI account needs billing setup")
                    break
    
    except KeyboardInterrupt:
        print("\n👋 Chat interrupted. Goodbye!")

def main():
    """Main test function"""
    print("🔑 OpenAI API Test Suite")
    print("=" * 50)
    
    # Test 1: Simple sync test
    sync_success = test_openai_sync()
    
    # Test 2: Async test (if sync worked)
    if sync_success:
        async_success = asyncio.run(test_openai_async())
        
        # Test 3: Interactive chat (if both worked)
        if async_success:
            try_chat = input("\n🎯 Want to try interactive chat? (y/n): ").lower().startswith('y')
            if try_chat:
                interactive_chat()
        else:
            print("❌ Skipping interactive chat due to async errors")
    else:
        print("❌ Skipping further tests due to sync errors")
    
    print("\n📋 Summary:")
    print("✅ If all tests pass: Your API key works!")
    print("❌ If quota error: Add billing to your OpenAI account")
    print("❌ If auth error: Check your API key")
    print("💡 Next: Fix the same issues in AI Dock app")

if __name__ == "__main__":
    main()
