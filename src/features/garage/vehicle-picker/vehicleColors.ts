export type VehicleColorOption = {
  id: string;
  name: string;
  hex: string;
};

export const vehicleColorOptions: VehicleColorOption[] = [
  { id: 'black', name: 'Black', hex: '#111317' },
  { id: 'white', name: 'White', hex: '#F2F1ED' },
  { id: 'grey', name: 'Grey', hex: '#777B82' },
  { id: 'silver', name: 'Silver', hex: '#B8BBC0' },
  { id: 'red', name: 'Red', hex: '#C51F2D' },
  { id: 'blue', name: 'Blue', hex: '#2457A6' },
  { id: 'green', name: 'Green', hex: '#315E46' },
  { id: 'yellow', name: 'Yellow', hex: '#D8B42C' },
  { id: 'orange', name: 'Orange', hex: '#D66B24' },
  { id: 'brown', name: 'Brown', hex: '#6E4B3A' },
  { id: 'beige', name: 'Beige', hex: '#B9A98E' },
  { id: 'purple', name: 'Purple', hex: '#664A80' },
];
