import {SubscriptionDTO, SubscriptionSchema} from "@psc/common";
import path from "path";
import fs from "fs";
import {KnownError} from "../errors/KnownError.js";
import {injectable} from 'tsyringe'

@injectable()
export default class FileService {

    private subscriptionsDir = path.join(process.cwd(), 'src', 'subscriptions');

    constructor() {
        if (!fs.existsSync(this.subscriptionsDir)) {
            fs.mkdirSync(this.subscriptionsDir, {recursive: true});
        }
    }

    saveSubscription(subscription: SubscriptionDTO) {
        try {
            const fileName = `${subscription.name}.json`;
            const filePath = path.join(this.subscriptionsDir, fileName);

            // 将 Subscription 对象转换为 JSON 字符串
            const jsonData = JSON.stringify(subscription, null, 2);

            // 写入文件
            fs.writeFileSync(filePath, jsonData);
        } catch (error) {
            throw new KnownError('保存订阅信息失败', error);
        }
    }

    listSubscription(): SubscriptionDTO[] {
        try {
            // 将目录下的文件转换成list
            const files = fs.readdirSync(this.subscriptionsDir);
            return files.map(file => {
                const content = fs.readFileSync(path.join(this.subscriptionsDir, file), 'utf8');
                return SubscriptionSchema.parse(JSON.parse(content));
            });
        } catch (error) {
            throw new KnownError('无法从文件系统中获取订阅信息', error);
        }
    }
}