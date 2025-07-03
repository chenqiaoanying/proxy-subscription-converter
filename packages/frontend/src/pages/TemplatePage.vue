<script setup lang="ts">

import {ref} from "vue";
import SubscriptionGeneratorDrawer from "@components/SubscriptionGeneratorDrawer.vue";

const drawerVisible = ref(false);
</script>

<template>

  <el-row justify="end">
    <el-button type="primary" @click="drawerVisible = true">添加订阅</el-button>
  </el-row>
  <el-divider/>
  <SubscriptionGeneratorDrawer v-model="drawerVisible"/>
</template>

<style scoped lang="scss">

</style>