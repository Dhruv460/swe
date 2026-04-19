import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import axios from 'axios';

// Vite-compatible way to load Leaflet icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const socket = io('http://localhost:3001');

// Fix for default Leaflet icons not showing correctly
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const StudentMap = () => {
  const [vehicles, setVehicles] = useState({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Fetch initial active vehicles on map load
    const fetchActiveVehicles = async () => {
      try {
        const { data } = await axios.get('http://localhost:3001/api/vehicles/active');
        const initialVehicles = {};
        data.forEach((vehicle) => {
          if (vehicle.lastLocation && vehicle.lastLocation.coordinates) {
            initialVehicles[vehicle._id] = {
              lat: vehicle.lastLocation.coordinates[1], // GeoJSON is [lng, lat]
              lng: vehicle.lastLocation.coordinates[0],
              type: vehicle.type,
              name: vehicle.name,
            };
          }
        });
        setVehicles(initialVehicles);
      } catch (error) {
        console.error("Failed to load active vehicles", error);
      }
    };
    
    fetchActiveVehicles();

    // Listen for real-time location updates from the Socket.IO server
    socket.on('locationUpdate', (data) => {
      const { vehicleId, coordinates, vehicleInfo } = data;
      
      setVehicles((prev) => ({
        ...prev,
        [vehicleId]: {
          lat: coordinates.latitude,
          lng: coordinates.longitude,
          type: vehicleInfo?.type || 'unknown',
          name: vehicleInfo?.name || `Vehicle ${vehicleId}`,
        },
      }));
    });

    // Listen for vehicles going offline to remove them from the map
    socket.on('vehicleOffline', (data) => {
      const { vehicleId } = data;
      setVehicles((prev) => {
        const updatedVehicles = { ...prev };
        delete updatedVehicles[vehicleId];
        return updatedVehicles;
      });
    });

    return () => {
      socket.off('locationUpdate');
      socket.off('vehicleOffline');
    };
  }, []);

  const filteredVehicles = Object.entries(vehicles).filter(([id, vehicle]) => {
    if (filter === 'all') return true;
    return vehicle.type === filter;
  });

  // Center map on IIT ISM Dhanbad
  const centerPosition = [23.8143, 86.4412];

  return (
    <div>
      <div style={{ padding: '10px', background: '#ecf0f1', borderBottom: '1px solid #bdc3c7' }}>
        <strong style={{ marginRight: '10px' }}>Show:</strong>
        <button onClick={() => setFilter('all')} style={{ marginRight: '5px', padding: '5px 10px', cursor: 'pointer' }}>All Vehicles</button>
        <button onClick={() => setFilter('bus')} style={{ marginRight: '5px', padding: '5px 10px', cursor: 'pointer' }}>Buses Only</button>
        <button onClick={() => setFilter('auto')} style={{ padding: '5px 10px', cursor: 'pointer' }}>Autos Only</button>
      </div>
      
      <MapContainer center={centerPosition} zoom={15} style={{ height: 'calc(100vh - 110px)', width: '100%', zIndex: 1 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {filteredVehicles.map(([id, vehicle]) => (
          <Marker key={id} position={[vehicle.lat, vehicle.lng]}>
            <Popup>
              <strong>{vehicle.name}</strong> <br />
              Type: {vehicle.type}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default StudentMap;