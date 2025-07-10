<script setup lang="ts">
import {type DeepReadonly, reactive} from 'vue';
import {ElMessage} from 'element-plus';
import {useSubscriptionStore} from "@/stores.ts";
import type {Subscription, SubscriptionCreateOrUpdate} from "@psc/common";
import {SubscriptionCreateOrUpdateSchema} from "@psc/common";

const store = useSubscriptionStore();
const {toUpdateSubscription = undefined} = defineProps<{
  toUpdateSubscription?: DeepReadonly<Subscription>
}>()

const visible = defineModel<boolean>("visible");
const subscription = reactive<SubscriptionCreateOrUpdate>({
  name: crypto.randomUUID(),
  url: "",
  userAgent: "proxy-subscribe-converter"
});

function onConfirm() {
  if (!subscription.name) {
    ElMessage.error('请输入订阅链接');
    return;
  }

  const {success, error, data} = SubscriptionCreateOrUpdateSchema.safeParse(subscription);

  if (!success) {
    ElMessage.error(error.message);
    return;
  }

  const update = toUpdateSubscription ? store.updateSubscription(toUpdateSubscription.id, data) : store.createSubscription(data);
  update.then(() => visible.value = false)
      .catch((err: Error) => ElMessage.error(err.message));
}

function onOpen() {
  if (toUpdateSubscription) {
    Object.assign(subscription, toUpdateSubscription)
  } else {
    Object.assign(subscription, {
      name: crypto.randomUUID(),
      url: "",
      userAgent: "proxy-subscribe-converter"
    });
  }
}

</script>

<template>
  <el-dialog title="添加订阅链接" v-model="visible" @open="onOpen">
    <el-form label-width="100px">
      <el-form-item label="名称">
        <el-input v-model="subscription.name" placeholder="请输入订阅名称"></el-input>
      </el-form-item>
      <el-form-item label="链接">
        <el-input v-model="subscription.url" placeholder="请输入订阅链接"></el-input>
      </el-form-item>
      <el-form-item label="用户代理">
        <el-input v-model="subscription.userAgent" placeholder="请输入用户代理"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="onConfirm">确 定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">

</style>