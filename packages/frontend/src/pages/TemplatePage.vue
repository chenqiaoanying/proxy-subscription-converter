<script setup lang="ts">
import {type DeepReadonly, onMounted, ref} from "vue";
import SubscriptionGeneratorDrawer from "@components/SubscriptionGeneratorDrawer.vue";
import {useSubscriptionGeneratorStore} from "@/stores.ts";
import {ElMessage} from "element-plus";
import {storeToRefs} from "pinia";
import type {SubscriptionGenerator} from "@psc/common";

const drawerVisible = ref(false);
const subscriptionGeneratorStore = useSubscriptionGeneratorStore();
const {generators} = storeToRefs(subscriptionGeneratorStore);
onMounted(() => {
  subscriptionGeneratorStore.forceReloadGenerators()
      .catch(err => {
        ElMessage.error(getErrorMessage(err.message));
      });
})

const selectedGenerator = ref<DeepReadonly<SubscriptionGenerator> | undefined>(undefined);

</script>

<template>
  <el-row justify="end">
    <el-button type="primary" @click="selectedGenerator = undefined; drawerVisible = true">添加订阅</el-button>
  </el-row>
  <el-divider/>
  <el-row>
    <el-card v-for="item in generators">
      <template #header>
        <span>{{ item.name }}</span>
      </template>
      <template #footer>
        <el-button @click="selectedGenerator = item; drawerVisible = true" type="primary">编辑</el-button>
        <el-button @click="subscriptionGeneratorStore.generate(item.id)" type="primary">预览</el-button>
      </template>
    </el-card>
  </el-row>
  <SubscriptionGeneratorDrawer v-model="drawerVisible" :to-update-subscription-generator="selectedGenerator"/>
</template>

<style scoped lang="scss">
.el-card {
  width: 300px;
  height: 300px;
  margin: 10px;
}
</style>