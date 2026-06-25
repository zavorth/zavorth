import React from 'react';

export default function OnboardingPage() {
  const pickerRoute = '/api/onboarding/model-picker';
  return (
    <div>
      <h1>Onboarding Model Picker</h1>
      <p>Consuming route: {pickerRoute}</p>
    </div>
  );
}
