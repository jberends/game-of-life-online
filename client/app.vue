<template>
  <div class="min-h-screen bg-gray-100">
    <div class="container mx-auto py-8">
      <h1 class="text-4xl font-bold text-center mb-8 text-gray-800">
        Multiplayer Game of Life
      </h1>
      
      <div class="flex justify-center">
        <div class="bg-white rounded-lg shadow-lg p-6">
          <GameBoard />
        </div>
      </div>
      
      <div class="text-center mt-8 text-gray-600">
        <p class="text-sm">
          Click on cells to add them to your staging area, then commit them to the board.
        </p>
        <p class="text-sm mt-2">
          Watch as your patterns evolve and interact with other players' creations!
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Set the page title
useHead({
  title: 'Multiplayer Game of Life'
});
</script>

<style>
body {
  font-family: 'Inter', system-ui, sans-serif;
}
</style>