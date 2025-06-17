import React from 'react';
import useSWR from 'swr';

interface WeatherData {
  main: {
    temp: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
}

interface WeatherWidgetProps {
  city: string;
  state: string;
}

const weatherFetcher = async (url: string): Promise<WeatherData> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Weather fetch failed');
  }
  return response.json();
};

const getWeatherIcon = (weatherMain: string): string => {
  switch (weatherMain.toLowerCase()) {
    case 'clear':
      return '☀️';
    case 'clouds':
      return '⛅';
    case 'rain':
    case 'drizzle':
      return '🌧️';
    case 'snow':
      return '❄️';
    case 'thunderstorm':
      return '⛈️';
    case 'mist':
    case 'fog':
    case 'haze':
      return '🌫️';
    default:
      return '🌤️';
  }
};

const WeatherWidget = ({ city, state }: WeatherWidgetProps) => {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
  
  // Format city name for OpenWeatherMap API - try multiple formats
  const formatCityQuery = (city: string, state: string) => {
    // First try: city,state,US format (recommended by docs)
    return `${encodeURIComponent(city)},${state},US`;
  };

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${formatCityQuery(city, state)}&appid=${apiKey}&units=imperial`;
  
  const { data: weather, error } = useSWR<WeatherData>(
    apiKey ? weatherUrl : null,
    weatherFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  if (error || !apiKey) {
    return null; // Graceful fallback - show nothing if weather fails
  }

  if (!weather) {
    return (
      <div className="p-2 text-gray-400 text-sm">
        ...
      </div>
    );
  }

  const temp = Math.round(weather.main.temp);
  const weatherMain = weather.weather[0]?.main || '';
  const icon = getWeatherIcon(weatherMain);

  return (
    <div className="flex items-center gap-1 p-2 text-gray-600 text-sm bg-gray-50 rounded-lg">
      <span className="font-medium">{temp}°</span>
      <span>{icon}</span>
    </div>
  );
};

export default WeatherWidget;