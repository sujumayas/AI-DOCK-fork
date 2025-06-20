# Refactoring Example: Large Component

This example shows how to refactor a typical large React component file into smaller, more maintainable pieces.

## Before: UserDashboard.tsx (400+ lines)

```typescript
// Everything in one file
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Stats, Activity } from '../types';
import './UserDashboard.css';

// Types mixed with component
interface UserDashboardProps {
  userId: string;
}

interface DashboardState {
  user: User | null;
  stats: Stats | null;
  activities: Activity[];
  loading: boolean;
  error: string | null;
}

// Utility functions mixed in
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US').format(date);
};

const calculateUsage = (activities: Activity[]): number => {
  return activities.reduce((sum, act) => sum + act.tokens, 0);
};

// API calls mixed in
const fetchUserData = async (userId: string) => {
  const response = await axios.get(`/api/users/${userId}`);
  return response.data;
};

const fetchUserStats = async (userId: string) => {
  const response = await axios.get(`/api/users/${userId}/stats`);
  return response.data;
};

// Sub-components mixed in
const StatsCard = ({ stats }: { stats: Stats }) => (
  <div className="stats-card">
    <h3>Usage Statistics</h3>
    <p>Total Tokens: {stats.totalTokens}</p>
    <p>This Month: {stats.monthlyTokens}</p>
  </div>
);

const ActivityList = ({ activities }: { activities: Activity[] }) => (
  <div className="activity-list">
    <h3>Recent Activity</h3>
    {activities.map(activity => (
      <div key={activity.id}>
        <span>{formatDate(activity.date)}</span>
        <span>{activity.model}</span>
        <span>{activity.tokens} tokens</span>
      </div>
    ))}
  </div>
);

// Main component with everything
export const UserDashboard: React.FC<UserDashboardProps> = ({ userId }) => {
  const [state, setState] = useState<DashboardState>({
    user: null,
    stats: null,
    activities: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const [user, stats, activities] = await Promise.all([
        fetchUserData(userId),
        fetchUserStats(userId),
        fetchUserActivities(userId)
      ]);

      setState({
        user,
        stats,
        activities,
        loading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard data'
      }));
    }
  };

  if (state.loading) return <div>Loading...</div>;
  if (state.error) return <div>Error: {state.error}</div>;
  if (!state.user) return <div>User not found</div>;

  const totalUsage = calculateUsage(state.activities);

  return (
    <div className="user-dashboard">
      <h1>Welcome, {state.user.name}!</h1>
      <div className="dashboard-grid">
        <StatsCard stats={state.stats!} />
        <ActivityList activities={state.activities} />
        <div className="usage-summary">
          <h3>Total Usage</h3>
          <p>{totalUsage} tokens used</p>
        </div>
      </div>
    </div>
  );
};
```

## After: Refactored Structure

### File Structure:
```
components/
└── UserDashboard/
    ├── index.tsx                    # Main component (50 lines)
    ├── UserDashboard.types.ts       # Types and interfaces
    ├── UserDashboard.hooks.ts       # Custom hooks
    ├── UserDashboard.utils.ts       # Utility functions
    ├── UserDashboard.api.ts         # API calls
    ├── UserDashboard.styles.css     # Styles
    └── components/
        ├── StatsCard.tsx            # Sub-component
        └── ActivityList.tsx         # Sub-component
```

### 1. UserDashboard.types.ts
```typescript
import { User, Stats, Activity } from '@/types';

export interface UserDashboardProps {
  userId: string;
}

export interface DashboardState {
  user: User | null;
  stats: Stats | null;
  activities: Activity[];
  loading: boolean;
  error: string | null;
}
```

### 2. UserDashboard.utils.ts
```typescript
import { Activity } from '@/types';

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US').format(date);
};

export const calculateUsage = (activities: Activity[]): number => {
  return activities.reduce((sum, act) => sum + act.tokens, 0);
};
```

### 3. UserDashboard.api.ts
```typescript
import axios from 'axios';
import { User, Stats, Activity } from '@/types';

export const userDashboardApi = {
  fetchUser: async (userId: string): Promise<User> => {
    const response = await axios.get(`/api/users/${userId}`);
    return response.data;
  },

  fetchStats: async (userId: string): Promise<Stats> => {
    const response = await axios.get(`/api/users/${userId}/stats`);
    return response.data;
  },

  fetchActivities: async (userId: string): Promise<Activity[]> => {
    const response = await axios.get(`/api/users/${userId}/activities`);
    return response.data;
  }
};
```

### 4. UserDashboard.hooks.ts
```typescript
import { useState, useEffect } from 'react';
import { DashboardState } from './UserDashboard.types';
import { userDashboardApi } from './UserDashboard.api';

export const useDashboardData = (userId: string) => {
  const [state, setState] = useState<DashboardState>({
    user: null,
    stats: null,
    activities: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const [user, stats, activities] = await Promise.all([
        userDashboardApi.fetchUser(userId),
        userDashboardApi.fetchStats(userId),
        userDashboardApi.fetchActivities(userId)
      ]);

      setState({
        user,
        stats,
        activities,
        loading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard data'
      }));
    }
  };

  return { ...state, refresh: loadDashboardData };
};
```

### 5. components/StatsCard.tsx
```typescript
import React from 'react';
import { Stats } from '@/types';

interface StatsCardProps {
  stats: Stats;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats }) => (
  <div className="stats-card">
    <h3>Usage Statistics</h3>
    <p>Total Tokens: {stats.totalTokens}</p>
    <p>This Month: {stats.monthlyTokens}</p>
  </div>
);
```

### 6. components/ActivityList.tsx
```typescript
import React from 'react';
import { Activity } from '@/types';
import { formatDate } from '../UserDashboard.utils';

interface ActivityListProps {
  activities: Activity[];
}

export const ActivityList: React.FC<ActivityListProps> = ({ activities }) => (
  <div className="activity-list">
    <h3>Recent Activity</h3>
    {activities.map(activity => (
      <div key={activity.id} className="activity-item">
        <span>{formatDate(activity.date)}</span>
        <span>{activity.model}</span>
        <span>{activity.tokens} tokens</span>
      </div>
    ))}
  </div>
);
```

### 7. index.tsx (Main Component - Now Only 50 Lines!)
```typescript
import React from 'react';
import { UserDashboardProps } from './UserDashboard.types';
import { useDashboardData } from './UserDashboard.hooks';
import { calculateUsage } from './UserDashboard.utils';
import { StatsCard } from './components/StatsCard';
import { ActivityList } from './components/ActivityList';
import './UserDashboard.styles.css';

export const UserDashboard: React.FC<UserDashboardProps> = ({ userId }) => {
  const { user, stats, activities, loading, error } = useDashboardData(userId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;

  const totalUsage = calculateUsage(activities);

  return (
    <div className="user-dashboard">
      <h1>Welcome, {user.name}!</h1>
      <div className="dashboard-grid">
        <StatsCard stats={stats!} />
        <ActivityList activities={activities} />
        <div className="usage-summary">
          <h3>Total Usage</h3>
          <p>{totalUsage} tokens used</p>
        </div>
      </div>
    </div>
  );
};

// Re-export for easier imports
export { StatsCard } from './components/StatsCard';
export { ActivityList } from './components/ActivityList';
export type { UserDashboardProps } from './UserDashboard.types';
```

## Benefits of This Refactoring

1. **Single Responsibility**: Each file has one clear purpose
2. **Easier Testing**: Can test utilities, API calls, and components separately
3. **Better Reusability**: Hooks and utilities can be used elsewhere
4. **Improved Maintainability**: Easy to find and modify specific functionality
5. **Type Safety**: Types are centralized and can be shared
6. **Cleaner Imports**: Clear what's being imported from where
7. **Scalability**: Easy to add new features without making files larger

## Key Principles Applied

- **Separation of Concerns**: Business logic, UI, API calls, and types are separated
- **DRY (Don't Repeat Yourself)**: Utilities can be reused
- **Testability**: Each piece can be unit tested independently
- **Readability**: Each file is focused and easy to understand
- **Maintainability**: Changes are localized to specific files
