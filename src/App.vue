<template>
    <div>
        <button @click="start">Start</button>
        <button @click="reset">Reset</button>
        <GaltonBoard ref="board" />
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import GaltonBoard from "./components/GaltonBoard.vue";

export default defineComponent({
    name: "App",
    components: { GaltonBoard },
    methods: {
        start() {
            (this.$refs.board as any).start();
        },
        reset() {
            (this.$refs.board as any).reset();
        },
    },
});
</script>

<style scoped></style>
