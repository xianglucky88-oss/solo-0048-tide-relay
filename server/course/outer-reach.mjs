export const outerReach = {
  id: 'outer-reach', name: '外湾夜班', home: 'dock', deadline: 18, capacity: 10, quota: 3,
  period: 6, weather: ['平潮', '涨潮', '涨潮', '满潮', '退潮', '退潮'],
  stations: [
    { id: 'dock', name: '西塘起航台', x: 15, y: 65, charge: 4 },
    { id: 'reed', name: '芦脊标', x: 32, y: 28, signal: 2, tune: 1 },
    { id: 'foam', name: '沫口标', x: 66, y: 19, signal: 3, tune: 2 },
    { id: 'jetty', name: '东灯补给点', x: 84, y: 57, charge: 5 },
    { id: 'shoal', name: '浅湾标', x: 58, y: 73, signal: 1, tune: 1 },
    { id: 'skerry', name: '石脊标', x: 39, y: 63, signal: 2, tune: 2 }
  ],
  lanes: [
    { id:'west', from:'dock', to:'reed', duration:2, power:2, phases:[0,1,2,3,4,5], assist:[1,2] },
    { id:'north', from:'reed', to:'foam', duration:2, power:3, phases:[1,2,3], assist:[1,2] },
    { id:'white', from:'foam', to:'jetty', duration:1, power:2, phases:[0,1,2,3,4,5], assist:[2,3] },
    { id:'east', from:'jetty', to:'shoal', duration:2, power:2, phases:[3,4,5], assist:[4,5] },
    { id:'inside', from:'shoal', to:'skerry', duration:1, power:2, phases:[0,1,2,3,4,5], assist:[4,5] },
    { id:'creek', from:'skerry', to:'dock', duration:2, power:2, phases:[0,1,2,3,4,5], assist:[4,5] },
    { id:'crossing', from:'reed', to:'skerry', duration:1, power:1, phases:[0,2,4], assist:[0] }
  ]
}
