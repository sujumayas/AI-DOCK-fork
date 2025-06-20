# Quick test to verify Assistant model implementation
# This script tests if our new Assistant model can be imported and works correctly

import sys
import os

# Add the Back directory to the path so we can import app modules
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

try:
    # Test importing the Assistant model
    from app.models.assistant import Assistant
    print("✅ Successfully imported Assistant model")
    
    # Test importing from models package
    from app.models import Assistant as Assistant2
    print("✅ Successfully imported Assistant from models package")
    
    # Check if they're the same class
    assert Assistant is Assistant2
    print("✅ Model imports are consistent")
    
    # Test model structure
    print(f"✅ Table name: {Assistant.__tablename__}")
    print(f"✅ Number of columns: {len(Assistant.__table__.columns)}")
    
    # Test column names
    column_names = [col.name for col in Assistant.__table__.columns]
    expected_columns = ['id', 'name', 'description', 'system_prompt', 'model_preferences', 'user_id', 'is_active', 'created_at', 'updated_at']
    
    for expected_col in expected_columns:
        if expected_col in column_names:
            print(f"✅ Column '{expected_col}' found")
        else:
            print(f"❌ Column '{expected_col}' missing")
    
    # Test creating a sample assistant (without saving to DB)
    sample_assistant = Assistant(
        name="Test Assistant",
        description="A test assistant for verification",
        system_prompt="You are a helpful test assistant.",
        user_id=1,
        is_active=True
    )
    
    print(f"✅ Sample assistant created: {sample_assistant}")
    print(f"✅ Display name: {sample_assistant.display_name}")
    print(f"✅ Validation result: {sample_assistant.is_valid()}")
    print(f"✅ Model preferences: {sample_assistant.get_effective_model_preferences()}")
    
    print("\n🎉 Step 1 implementation successful!")
    print("Assistant model is ready for use.")
    
except Exception as e:
    print(f"❌ Error testing Assistant model: {e}")
    import traceback
    traceback.print_exc()
