import React from 'react';

export default function ProvidersPage() {
  const pickerRoute = '/api/onboarding/model-picker?includeAdvanced=true';
  const ProvidersModelPickerSummary = 'ProvidersModelPickerSummary';
  return (
    <div data-route="pickerRoute=">
      <h1>Providers</h1>
      <p>Route: {pickerRoute}</p>
      <p>Summary: {ProvidersModelPickerSummary}</p>
    </div>
  );
}
