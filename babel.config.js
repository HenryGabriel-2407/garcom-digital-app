module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // outros plugins aqui, se tiver
      'react-native-reanimated/plugin', 
    ],
  };
};