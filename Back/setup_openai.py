#!/usr/bin/env python3
"""
🔑 OpenAI API Key Setup Script
This script adds your OpenAI API key to the AI Dock database
Run this once to set up ChatGPT integration for testing
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_db
from app.models.llm_config import LLMConfiguration, LLMProvider

async def setup_openai_config():
    """Add OpenAI configuration to database"""
    
    # 🔑 PASTE YOUR OPENAI API KEY HERE:
    # Get your key from: https://platform.openai.com/api-keys
    OPENAI_API_KEY = "***REMOVED***"  # 👈 REPLACE THIS
    
    if OPENAI_API_KEY == "sk-your-openai-api-key-here":
        print("❌ Please replace 'sk-your-openai-api-key-here' with your actual OpenAI API key!")
        print("📍 Edit this file and paste your key on line 15")
        print("🔗 Get your key from: https://platform.openai.com/api-keys")
        return
    
    if not OPENAI_API_KEY.startswith("sk-"):
        print("❌ Invalid OpenAI API key format. Should start with 'sk-'")
        return
    
    print("🔄 Setting up OpenAI configuration...")
    
    # Get database session
    async for db in get_async_db():
        try:
            # Check if OpenAI config already exists
            from sqlalchemy import select
            existing = await db.execute(
                select(LLMConfiguration).where(LLMConfiguration.name == "OpenAI ChatGPT")
            )
            if existing.scalar_one_or_none():
                print("ℹ️ OpenAI configuration already exists, updating...")
                config = existing.scalar_one()
            else:
                print("➕ Creating new OpenAI configuration...")
                config = LLMConfiguration()
            
            # 🎛️ Configure OpenAI settings
            config.name = "OpenAI ChatGPT"
            config.provider = LLMProvider.OPENAI
            config.provider_name = "OpenAI"
            config.api_key = OPENAI_API_KEY  # Your API key
            config.base_url = "https://api.openai.com/v1"
            config.default_model = "gpt-3.5-turbo"
            config.available_models = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo-preview"]
            config.is_active = True
            config.is_public = True  # Available to all users
            config.priority = 1
            config.max_tokens_per_request = 4000
            config.rate_limit_per_minute = 60
            config.cost_per_1k_input_tokens = 0.0010  # GPT-3.5-turbo pricing
            config.cost_per_1k_output_tokens = 0.0020
            config.has_cost_tracking = True
            
            # 🎯 Configuration parameters for OpenAI
            config.configuration_params = {
                "temperature": 0.7,
                "max_tokens": 1000,
                "top_p": 1.0,
                "frequency_penalty": 0,
                "presence_penalty": 0
            }
            
            # 💾 Save to database
            if not existing.scalar_one_or_none():
                db.add(config)
            
            await db.commit()
            
            print("✅ OpenAI configuration saved successfully!")
            print(f"📝 Configuration name: {config.name}")
            print(f"🤖 Default model: {config.default_model}")
            print(f"🌐 Available models: {', '.join(config.available_models)}")
            print(f"💰 Cost tracking: {'Enabled' if config.has_cost_tracking else 'Disabled'}")
            print("")
            print("🚀 Ready to test! Go to http://localhost:8080/chat")
            print("🎯 Your OpenAI configuration should appear in the provider dropdown")
            
        except Exception as e:
            print(f"❌ Error setting up configuration: {e}")
            print("🔍 Make sure your backend server is running and database is accessible")
            
        finally:
            await db.close()
            break

if __name__ == "__main__":
    print("🔑 AI Dock - OpenAI API Key Setup")
    print("=" * 40)
    asyncio.run(setup_openai_config())
