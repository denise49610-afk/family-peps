export type WeatherNow = {
  temp: number;
  code: number;
  label: string;
  city: string;
};

const WMO: Record<number, string> = {
  0: "Ciel clair",
  1: "Plutôt clair",
  2: "Partiellement nuageux",
  3: "Couvert",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine",
  61: "Pluie légère",
  63: "Pluie",
  65: "Forte pluie",
  71: "Neige légère",
  80: "Averses",
  95: "Orage",
};

export function weatherLabel(code: number): string {
  return WMO[code] ?? "Météo";
}

export async function fetchWeather(city: string): Promise<WeatherNow | null> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city || "Angers")}&count=1&language=fr&format=json`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!geoRes.ok) return null;
    const geo = (await geoRes.json()) as {
      results?: { latitude: number; longitude: number; name: string }[];
    };
    const place = geo.results?.[0];
    if (!place) return null;
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=Europe%2FParis`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!wxRes.ok) return null;
    const wx = (await wxRes.json()) as {
      current?: { temperature_2m: number; weather_code: number };
    };
    if (!wx.current) return null;
    return {
      temp: Math.round(wx.current.temperature_2m),
      code: wx.current.weather_code,
      label: weatherLabel(wx.current.weather_code),
      city: place.name,
    };
  } catch {
    return null;
  }
}
