import React, { useState } from 'react';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import IndexOld from './Index';
import IndexNew from './IndexNew';

const TestComparison = () => {
  const [useNewImplementation, setUseNewImplementation] = useState(false);
  
  return (
    <div>
      {/* Toggle Switch */}
      <div className="fixed top-4 right-4 z-50 bg-white p-4 rounded-lg shadow-lg border">
        <div className="flex items-center space-x-2">
          <Switch
            id="implementation-mode"
            checked={useNewImplementation}
            onCheckedChange={setUseNewImplementation}
          />
          <Label htmlFor="implementation-mode" className="cursor-pointer">
            {useNewImplementation ? '🆕 New DB Views' : '🔧 Legacy JSON'}
          </Label>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {useNewImplementation 
            ? 'Using Supabase views (simplified)'
            : 'Using JSON files (current)'}
        </div>
      </div>
      
      {/* Render selected implementation */}
      {useNewImplementation ? <IndexNew /> : <IndexOld />}
    </div>
  );
};

export default TestComparison;