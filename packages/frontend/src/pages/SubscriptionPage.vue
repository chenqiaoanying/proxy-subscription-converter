<script setup lang="ts">
import {type DeepReadonly, onMounted, reactive, ref} from "vue";
import SubscriptionDialog from "@components/SubscriptionDialog.vue";
import {useSubscriptionStore} from "@/stores.ts";
import {storeToRefs} from 'pinia';
import {ElMessage} from "element-plus";
import {Delete, Edit, Refresh} from '@element-plus/icons-vue';
import type {Subscription} from "@psc/common";

const store = useSubscriptionStore();
const subscriptions = storeToRefs(store).subscriptions;
const dialogVisible = ref(false);
const selectedSubscription = ref<DeepReadonly<Subscription> | undefined>(undefined);

const loading = reactive(new Set<number>());

onMounted(() => {
  store.forceReloadSubscriptions()
      .catch(err => {
        ElMessage.error(err.message);
      });
})

function refreshSubscription(id: number) {
  loading.add(id);
  store.getSubscription(id, true)
      .catch(err => ElMessage.error(err.message))
      .finally(() => loading.delete(id))
}

function updateSubscription(subscription: DeepReadonly<Subscription>) {
  selectedSubscription.value = subscription;
  dialogVisible.value = true;
}
</script>
<template>
  <el-row justify="end">
    <el-button type="primary" @click="selectedSubscription = undefined; dialogVisible = true">添加订阅链接</el-button>
  </el-row>
  <el-divider/>
  <el-row>
    <el-card v-for="item in subscriptions" v-loading="loading.has(item.id)">
      <template #header>
        <span>{{ item.name }}</span>
      </template>
      <div class="card-content">
        <el-progress v-if="item.dataUsage" type="line" :percentage="(item.dataUsage?.download + item.dataUsage?.upload)/item.dataUsage?.total * 100"/>
        <el-progress v-else type="line" :percentage="100"/>
      </div>
      <template #footer>
        <el-button type="primary" @click="refreshSubscription(item.id)" :icon="Refresh"/>
        <el-button type="primary" @click="updateSubscription(item)" :icon="Edit"/>
        <el-button type="primary" @click="store.deleteSubscription(item.id)" :icon="Delete"/>
      </template>
    </el-card>
  </el-row>
  <SubscriptionDialog v-model:visible="dialogVisible" :to-update-subscription="selectedSubscription" />
</template>

<style scoped lang="scss">
.el-card {
  width: 300px;
  margin: 10px;
}
</style>