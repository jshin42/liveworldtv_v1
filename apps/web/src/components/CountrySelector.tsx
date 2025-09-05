import React from 'react';
import { CountryCode } from '../../../packages/shared-types/src';

interface CountrySelectorProps {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({ value, onChange }) => {
  const countries = [
    { code: 'US' as CountryCode, name: 'United States', flag: '🇺🇸' },
    { code: 'UK' as CountryCode, name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'DE' as CountryCode, name: 'Germany', flag: '🇩🇪' },
    { code: 'FR' as CountryCode, name: 'France', flag: '🇫🇷' },
    { code: 'ES' as CountryCode, name: 'Spain', flag: '🇪🇸' },
    { code: 'JP' as CountryCode, name: 'Japan', flag: '🇯🇵' },
    { code: 'IT' as CountryCode, name: 'Italy', flag: '🇮🇹' },
    { code: 'PT' as CountryCode, name: 'Portugal', flag: '🇵🇹' },
    { code: 'RU' as CountryCode, name: 'Russia', flag: '🇷🇺' },
    { code: 'KR' as CountryCode, name: 'South Korea', flag: '🇰🇷' },
    { code: 'CN' as CountryCode, name: 'China', flag: '🇨🇳' }
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Country
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CountryCode)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.flag} {country.name}
          </option>
        ))}
      </select>
    </div>
  );
};