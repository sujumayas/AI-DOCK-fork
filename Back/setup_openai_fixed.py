#!/usr/bin/env python3
"""
🔑 OpenAI API Key Setup Script - FIXED VERSION
This script adds your OpenAI API key to the AI Dock database
Includes automatic schema fixing for compatibility
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_db, async_engine
from app.models import Base, LLMConfiguration, LLMProvider

async def setup_openai_config():
    """Add OpenAI configuration to database with schema auto-fix"""
    
    # 🔑 PASTE YOUR OPENAI API KEY HERE:
    # Get your key from: https://platform.openai.com/api-keys
    OPENAI_API_KEY = "sk-your-openai-api-key-here"  # 👈 Your API key
    
    if OPENAI_API_KEY == "sk-your-openai-api-key-here":
        print("❌ Please replace 'sk-your-openai-api-key-here' with your actual OpenAI API key!")
        print("📍 Edit this file and paste your key on line 17")
        print("🔗 Get your key from: https://platform.openai.com/api-keys")
        return
    
    if not OPENAI_API_KEY.startswith("sk-"):
        print("❌ Invalid OpenAI API key format. Should start with 'sk-'")
        return
    
    print("🔄 Setting up OpenAI configuration...")
    
    try:
        # First, ensure the database schema is correct
        print("🗄️ Ensuring database schema is up to date...")
        async with async_engine.begin() as conn:
            # Create all tables (this will create missing tables/columns)
            await conn.run_sync(Base.metadata.create_all)
            print("✅ Database schema updated!")
        
        # Get database session
        async for db in get_async_db():
            try:
                # Check if OpenAI config already exists
                from sqlalchemy import select
                existing = await db.execute(
                    select(LLMConfiguration).where(LLMConfiguration.name == "OpenAI ChatGPT")
                )
                
                existing_config = existing.scalar_one_or_none()
                
                if existing_config:
                    print("ℹ️ OpenAI configuration already exists, updating...")
                    config = existing_config
                else:
                    print("➕ Creating new OpenAI configuration...")
                    config = LLMConfiguration()
                
                # 🎛️ Configure OpenAI settings with proper field names
                config.name = "OpenAI ChatGPT"
                config.description = "OpenAI GPT models for general purpose chat"
                config.provider = LLMProvider.OPENAI
                config.api_endpoint = "https://api.openai.com/v1"
                config.set_encrypted_api_key(OPENAI_API_KEY)  # Use the proper method
                config.api_version = "2023-05-15"
                config.default_model = "gpt-3.5-turbo"
                config.available_models = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo-preview"]
                config.is_active = True
                config.is_public = True  # Available to all users
                config.priority = 1
                config.rate_limit_rpm = 3000
                config.rate_limit_tpm = 90000
                config.cost_per_1k_input_tokens = 0.001  # GPT-3.5-turbo pricing
                config.cost_per_1k_output_tokens = 0.002
                config.monthly_budget_usd = 100.00
                
                # 🎯 Model parameters for OpenAI
                config.model_parameters = {
                    "temperature": 0.7,
                    "max_tokens": 1000,
                    "top_p": 1.0,
                    "frequency_penalty": 0,
                    "presence_penalty": 0
                }
                
                # 💾 Save to database
                if not existing_config:
                    db.add(config)
                
                await db.commit()
                
                print("✅ OpenAI configuration saved successfully!")
                print(f"📝 Configuration name: {config.name}")
                print(f"🤖 Default model: {config.default_model}")
                print(f"🌐 Available models: {', '.join(config.available_models)}")
                print(f"💰 Cost tracking: {'Enabled' if config.has_cost_tracking else 'Disabled'}")
                print("")
                print("🚀 Ready to test! Go to http://localhost:5173/chat")
                print("🎯 Your OpenAI configuration should appear in the provider dropdown")
                
            except Exception as e:
                print(f"❌ Error setting up configuration: {e}")
                print("🔍 Make sure your backend server is running and database is accessible")
                
            finally:
                await db.close()
                break
                
    except Exception as e:
        print(f"❌ Database schema error: {e}")
        print("💡 Try stopping your backend server and running this script again")

if __name__ == "__main__":
    print("🔑 AI Dock - OpenAI API Key Setup (Fixed)")
    print("=" * 45)
    asyncio.run(setup_openai_config())
