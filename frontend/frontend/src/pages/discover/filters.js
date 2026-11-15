// Filter lists for the Discover page. Keep TOPICS and the country codes in step with backend/src/services/external.js.

// What a person can pick. The backend maps each one to the provider's own category name.
export const TOPICS = ["Music", "Sports", "Cricket", "Football", "Comedy", "Theatre", "Film", "Family"];

// Countries the provider covers, each with its main event cities (cities are suggestions, not a complete list).
export const COUNTRIES = [
  { code: "IN", name: "India", cities: ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"] },
  { code: "US", name: "United States", cities: ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "San Francisco"] },
  { code: "GB", name: "United Kingdom", cities: ["London", "Manchester", "Birmingham", "Glasgow"] },
  { code: "AU", name: "Australia", cities: ["Sydney", "Melbourne", "Brisbane", "Perth"] },
  { code: "CA", name: "Canada", cities: ["Toronto", "Vancouver", "Montreal"] },
  { code: "AE", name: "United Arab Emirates", cities: ["Dubai", "Abu Dhabi"] },
  { code: "NZ", name: "New Zealand", cities: ["Auckland", "Wellington"] },
  { code: "IE", name: "Ireland", cities: ["Dublin"] },
  { code: "DE", name: "Germany", cities: ["Berlin", "Munich"] },
];

export const countryName = (code) => COUNTRIES.find((c) => c.code === code)?.name || "";
export const citiesOf = (code) => COUNTRIES.find((c) => c.code === code)?.cities || [];
